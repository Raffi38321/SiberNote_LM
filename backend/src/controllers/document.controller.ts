import type { Request, Response } from "express"
import { Readable } from "stream"
import cloudinary from "../services/cloudinary.js"
import Document from "../models/document.model.js"
import Notebook from "../models/notebook.model.js"
import response from "../utils/response.js"

// ─── helpers ────────────────────────────────────────────────────────────────

const MIME_TO_FILETYPE: Record<string, string> = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
}

/**
 * Upload buffer ke Cloudinary via stream.
 * Mengembalikan secure_url hasil upload.
 */
const uploadToCloudinary = (
    buffer: Buffer,
    filename: string,
    folder: string,
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: "raw",  // PDF/PPTX bukan image
                public_id: filename,
                use_filename: true,
                unique_filename: false,
                overwrite: false,
            },
            (error, result) => {
                if (error || !result) {
                    reject(error ?? new Error("cloudinary upload gagal"))
                } else {
                    resolve(result.secure_url)
                }
            },
        )
        Readable.from(buffer).pipe(uploadStream)
    })
}

// ─── upload document ─────────────────────────────────────────────────────────

export const uploadDocument = async (req: Request, res: Response) => {
    try {
        const userId = req.userId
        if (!userId) {
            return response.userError(res, "tidak terautentikasi")
        }

        const { notebookId } = req.params

        // pastikan notebook ada dan milik user yang request
        const notebook = await Notebook.findOne({ _id: notebookId, userId })
        if (!notebook) {
            return response.notFoundError(res, "notebook tidak ditemukan atau bukan milik user")
        }

        // multer sudah validasi file — kalau tidak ada berarti tidak dikirim
        if (!req.file) {
            return response.userError(res, "file tidak ditemukan, kirim file dengan field name 'file'")
        }

        const { originalname, mimetype, buffer, size } = req.file
        const fileType = MIME_TO_FILETYPE[mimetype]

        // buat public_id yang bersih: hapus ekstensi, ganti spasi
        const baseName = originalname.replace(/\.[^.]+$/, "").replace(/\s+/g, "_")
        const folder = `sibernote/${userId}/${notebookId}`

        const fileUrl = await uploadToCloudinary(buffer, baseName, folder)

        const doc = await Document.create({
            notebookId,
            title: baseName,
            fileType,
            fileUrl,
            fileSize: size,
            totalPages: 0,      // diupdate setelah proses parsing
            parseStatus: "pending",
        })

        return response.requestSuccessWithData(res, "berhasil upload dokumen", { document: doc }, 201)
    } catch (error) {
        console.error(error)
        return response.serverError(res, "gagal upload dokumen")
    }
}

// ─── get all documents by notebook ──────────────────────────────────────────

export const getDocumentsByNotebook = async (req: Request, res: Response) => {
    try {
        const userId = req.userId
        if (!userId) {
            return response.userError(res, "tidak terautentikasi")
        }

        const { notebookId } = req.params

        const notebook = await Notebook.findOne({ _id: notebookId, userId })
        if (!notebook) {
            return response.notFoundError(res, "notebook tidak ditemukan atau bukan milik user")
        }

        const documents = await Document.find({ notebookId }).sort({ createdAt: -1 })

        return response.requestSuccessWithData(res, "berhasil get dokumen", { documents }, 200)
    } catch (error) {
        console.error(error)
        return response.serverError(res, "gagal get dokumen")
    }
}

// ─── delete document ─────────────────────────────────────────────────────────

export const deleteDocument = async (req: Request, res: Response) => {
    try {
        const userId = req.userId
        if (!userId) {
            return response.userError(res, "tidak terautentikasi")
        }

        const { documentId } = req.params

        // join ke notebook untuk verifikasi kepemilikan
        const doc = await Document.findById(documentId).populate<{
            notebookId: { userId: { toString(): string } }
        }>("notebookId")

        if (!doc) {
            return response.notFoundError(res, "dokumen tidak ditemukan")
        }

        if (doc.notebookId.userId.toString() !== userId) {
            return response.notAuthorizedError(res, "tidak punya akses ke dokumen ini")
        }

        // hapus dari cloudinary
        // public_id = folder/baseName (tanpa ekstensi di raw resource)
        const urlParts = doc.fileUrl.split("/")
        const uploadIndex = urlParts.indexOf("upload")
        // ambil path setelah "upload/v<angka>/"
        const publicIdWithExt = urlParts.slice(uploadIndex + 2).join("/")
        const publicId = publicIdWithExt.replace(/\.[^.]+$/, "")

        await cloudinary.uploader.destroy(publicId, { resource_type: "raw" })

        await doc.deleteOne()

        return response.requestSuccess(res, "berhasil hapus dokumen")
    } catch (error) {
        console.error(error)
        return response.serverError(res, "gagal hapus dokumen")
    }
}
