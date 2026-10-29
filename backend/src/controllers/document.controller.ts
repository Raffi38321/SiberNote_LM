import fs from "fs"
import path from "path"
import type { Request, Response } from "express"
import mongoose from "mongoose"
import Document from "../models/document.model.js"
import Notebook from "../models/notebook.model.js"
import Chunk from "../models/chunk.model.js"
import { chunkPDF, chunkPPTX, chunkTXT, chunkDOCX } from "../services/chunking.js"
import response from "../utils/response.js"
import envVariable from "../utils/ENV.js"

type FileType = "pdf" | "pptx" | "txt" | "docx"

const MIME_TO_FILETYPE: Record<string, FileType> = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
}

const MIME_TO_EXT: Record<string, string> = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
}

/**
 * Simpan buffer file ke disk dan kembalikan URL publiknya.
 * Folder: {UPLOADS_DIR}/documents/{userId}/{notebookId}/
 * URL:    {UPLOAD_BASE_URL}/documents/{userId}/{notebookId}/{filename}.{ext}
 */
const saveFileToDisk = (
    buffer: Buffer,
    baseName: string,
    mimetype: string,
    userId: string,
    notebookId: string,
): string => {
    const ext = MIME_TO_EXT[mimetype] ?? "bin"
    const filename = `${baseName}.${ext}`
    const dir = path.join(envVariable.UPLOADS_DIR, "documents", userId, notebookId)

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }

    const filePath = path.join(dir, filename)
    fs.writeFileSync(filePath, buffer)

    // Normalise UPLOAD_BASE_URL (hapus trailing slash)
    const base = envVariable.UPLOAD_BASE_URL.replace(/\/$/, "")
    return `${base}/documents/${userId}/${notebookId}/${filename}`
}

// ── upload document ──────────────────────────────────────────────────────────

export const uploadDocument = async (req: Request, res: Response) => {
    try {
        const userId = req.userId
        if (!userId) {
            return response.userError(res, "tidak terautentikasi")
        }

        const { notebookId } = req.params

        if (!notebookId || typeof notebookId !== "string") {
            return response.userError(res, "notebookId tidak valid")
        }

        const notebook = await Notebook.findOne({ _id: notebookId, userId })
        if (!notebook) {
            return response.notFoundError(res, "notebook tidak ditemukan atau bukan milik user")
        }

        if (!req.file) {
            return response.userError(res, "file tidak ditemukan, kirim file dengan field name 'file'")
        }

        const { originalname, mimetype, buffer, size } = req.file
        const fileType = MIME_TO_FILETYPE[mimetype]

        if (!fileType) {
            return response.userError(res, "Format tidak didukung, hanya PDF, PPTX, DOCX, dan TXT")
        }

        const baseName = originalname.replace(/\.[^.]+$/, "").replace(/\s+/g, "_")
        const fileUrl = saveFileToDisk(buffer, baseName, mimetype, userId, notebookId)

        const notebookObjectId = new mongoose.Types.ObjectId(notebookId)

        // simpan dokumen dengan status "pending"
        const doc = await Document.create({
            notebookId: notebookObjectId,
            title: baseName,
            fileType,
            fileUrl,
            fileSize: size,
            totalPages: 0,
            parseStatus: "pending",
        })

        // proses chunking setelah response dikirim ke FE supaya tidak block user
        setImmediate(async () => {
            try {
                const { chunks, totalPages } = fileType === "pdf"
                    ? await chunkPDF(buffer, doc._id)
                    : fileType === "pptx"
                        ? await chunkPPTX(buffer, doc._id)
                        : fileType === "docx"
                            ? await chunkDOCX(buffer, doc._id)
                            : await chunkTXT(buffer, doc._id)

                if (chunks.length > 0) {
                    await Chunk.insertMany(chunks)
                }

                await Document.findByIdAndUpdate(doc._id, {
                    parseStatus: "done",
                    totalPages,
                    parseError: "",
                })

                console.log(`[chunking] berhasil ${doc.title} — ${totalPages} halaman, ${chunks.length} chunks`)
            } catch (err) {
                const errorMessage = err instanceof Error
                    ? err.message
                    : "Gagal memproses dokumen, silakan coba lagi."

                console.error(`[chunking] gagal proses ${doc.title}:`, err)

                await Document.findByIdAndUpdate(doc._id, {
                    parseStatus: "error",
                    parseError: errorMessage,
                })
            }
        })

        return response.requestSuccessWithData(res, "berhasil upload dokumen", { document: doc }, 201)
    } catch (error) {
        console.error(error)
        return response.serverError(res, "gagal upload dokumen")
    }
}


export const getDocumentsByNotebook = async (req: Request, res: Response) => {
    try {
        const userId = req.userId
        if (!userId) {
            return response.userError(res, "tidak terautentikasi")
        }

        const { notebookId } = req.params

        if (!notebookId || typeof notebookId !== "string") {
            return response.userError(res, "notebookId tidak valid")
        }

        const notebook = await Notebook.findOne({ _id: notebookId, userId })
        if (!notebook) {
            return response.notFoundError(res, "notebook tidak ditemukan atau bukan milik user")
        }

        const notebookObjectId = new mongoose.Types.ObjectId(notebookId)
        const documents = await Document.find({ notebookId: notebookObjectId }).sort({ createdAt: -1 })

        return response.requestSuccessWithData(res, "berhasil get dokumen", { documents }, 200)
    } catch (error) {
        console.error(error)
        return response.serverError(res, "gagal get dokumen")
    }
}

// delete document — kepemilikan dicek di isDocumentOwner
export const deleteDocument = async (req: Request, res: Response) => {
    try {
        const { documentId } = req.params

        const doc = await Document.findById(documentId)
        if (!doc) {
            return response.notFoundError(res, "dokumen tidak ditemukan")
        }

        // Hapus file fisik dari disk
        // fileUrl format: {UPLOAD_BASE_URL}/documents/{userId}/{notebookId}/{filename}
        const base = envVariable.UPLOAD_BASE_URL.replace(/\/$/, "")
        const relativePath = doc.fileUrl.replace(base, "")  // /documents/userId/notebookId/file.pdf
        const filePath = path.join(envVariable.UPLOADS_DIR, relativePath)

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
        }

        // Coba hapus folder notebookId jika sudah kosong
        try {
            const parentDir = path.dirname(filePath)
            if (fs.readdirSync(parentDir).length === 0) {
                fs.rmdirSync(parentDir)
            }
        } catch {
            // abaikan jika gagal; folder mungkin masih punya file lain
        }

        await Chunk.deleteMany({ documentId: doc._id })
        await doc.deleteOne()

        return response.requestSuccess(res, "berhasil hapus dokumen")
    } catch (error) {
        console.error(error)
        return response.serverError(res, "gagal hapus dokumen")
    }
}


// update nama document — kepemilikan dicek di isDocumentOwner
export const updateDocument = async (req: Request, res: Response) => {
    try {
        const { name } = req.body
        const { documentId } = req.params

        const document = await Document.findByIdAndUpdate(
            documentId,
            { title: name },
            { returnDocument: "after" },
        )
        if (!document) {
            return response.notFoundError(res, "document ga ketemu")
        }
        return response.requestSuccessWithData(res, "berhasil update document", { document }, 200)
    } catch (error) {
        return response.serverError(res, "gagal update dokumen")
    }
}

// export const getCitationsByDocument = async (req: Request, res: Response) => {
//     try {
//         const userId = req.userId
//         if (!userId) {
//             return response.userError(res, "tidak terautentikasi")
//         }

//         const { documentId } = req.params

//         const doc = await Document.findById(documentId)
//             .select("notebookId title fileType")
//             .populate<{ notebookId: { userId: { toString(): string } } }>("notebookId", "userId")

//         if (!doc) {
//             return response.notFoundError(res, "dokumen tidak ditemukan")
//         }

//         if (doc.notebookId.userId.toString() !== userId) {
//             return response.notAuthorizedError(res, "tidak punya akses ke dokumen ini")
//         }

//         const chunks = await Chunk.find({ documentId })
//             .select("chunkIndex content pageStart pageEnd")
//             .sort({ chunkIndex: 1 })
//             .lean()

//         return response.requestSuccessWithData(res, "berhasil get citations", { chunks }, 200)
//     } catch (error) {
//         console.error(error)
//         return response.serverError(res, "gagal get citations")
//     }
// }
export const getDocumentStatus = async (req: Request, res: Response) => {
    try {
        const userId = req.userId
        if (!userId) {
            return response.userError(res, "tidak terautentikasi")
        }

        const { documentId } = req.params

        const doc = await Document.findById(documentId)
            .select("parseStatus parseError totalPages notebookId")
            .populate<{ notebookId: { userId: { toString(): string } } }>("notebookId", "userId")

        if (!doc) {
            return response.notFoundError(res, "dokumen tidak ditemukan")
        }

        if (doc.notebookId.userId.toString() !== userId) {
            return response.notAuthorizedError(res, "tidak punya akses ke dokumen ini")
        }

        return response.requestSuccessWithData(res, "berhasil get status dokumen", {
            parseStatus: doc.parseStatus,
            parseError:  doc.parseError,
            totalPages:  doc.totalPages,
        }, 200)
    } catch (error) {
        console.error(error)
        return response.serverError(res, "gagal get status dokumen")
    }
}
