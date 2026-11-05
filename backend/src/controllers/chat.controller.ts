import type { Request, Response } from "express"
import mongoose from "mongoose"
import { GoogleGenerativeAI } from "@google/generative-ai"
import response from "../utils/response.js"
import Message from "../models/message.model.js"
import Document from "../models/document.model.js"
import Chunk from "../models/chunk.model.js"
import { generateQueryEmbedding } from "../services/embedding.js"
import { askLLM } from "../services/LLM.js"
import type { RetrievedChunk, ChatHistoryEntry } from "../services/LLM.js"
import envVariable from "../utils/ENV.js"

const summaryGenAI = new GoogleGenerativeAI(envVariable.GEMINI_MODEL)
const summaryModel = summaryGenAI.getGenerativeModel({ model: "gemini-3.5-flash" })

const HISTORY_LIMIT = 4
const TOP_K = 5
const NUM_CANDIDATES = 100

const vectorSearch = async (
    queryVector: number[],
    documentIds: mongoose.Types.ObjectId[],
): Promise<RetrievedChunk[]> => {
    const results = await Chunk.aggregate([
        {
            $vectorSearch: {
                index: "chunks_vector_index",
                path: "embedding",
                queryVector,
                numCandidates: NUM_CANDIDATES,
                limit: TOP_K,
                filter: { documentId: { $in: documentIds } },
            },
        },
        {
            $project: {
                _id: 0,
                documentId: 1,
                content: 1,
                pageStart: 1,
                pageEnd: 1,
                score: { $meta: "vectorSearchScore" },
            },
        },
    ])

    const docIds = [...new Set(results.map((r: { documentId: mongoose.Types.ObjectId }) => r.documentId.toString()))]
    const docs = await Document.find({ _id: { $in: docIds } }).select("title")
    const titleMap = new Map(docs.map((d) => [d._id.toString(), d.title]))

    return results.map((r: {
        documentId: mongoose.Types.ObjectId
        content: string
        pageStart: number
        pageEnd: number
        score: number
    }): RetrievedChunk => ({
        documentId: r.documentId,
        documentTitle: titleMap.get(r.documentId.toString()) ?? "Unknown",
        pageStart: r.pageStart,
        pageEnd: r.pageEnd,
        content: r.content,
        score: r.score,
    }))
}


export const sendMessage = async (req: Request, res: Response) => {
    try {
        const userId = req.userId
        if (!userId) {
            return response.userError(res, "tidak terautentikasi", 401)
        }

        const { notebookId } = req.params
        
        if (!notebookId || typeof notebookId !== "string") {
            return response.userError(res, "notebookId tidak valid")
        }
        const { message } = req.body as { message: string }

        const readyDocuments = await Document.find({
            notebookId,
            parseStatus: "done",
        }).select("_id")

        if (readyDocuments.length === 0) {
            return response.userError(
                res,
                "belum ada dokumen yang selesai diproses di notebook ini",
                422,
            )
        }

        const documentIds = readyDocuments.map((d) => d._id as mongoose.Types.ObjectId)

        const userMessage = await Message.create({
            notebookId,
            role: "user",
            content: message,
            citations: [],
            sourceType: null,
        })

        const recentMessages = await Message.find({
            notebookId,
            _id: { $ne: userMessage._id },
        })
            .sort({ createdAt: -1 })
            .limit(HISTORY_LIMIT)
            .select("role content")
            .lean()
        const history: ChatHistoryEntry[] = recentMessages
            .reverse()
            .map((m) => ({ role: m.role, content: m.content }))

        const queryVector = await generateQueryEmbedding(message)

        const chunks = await vectorSearch(queryVector, documentIds)
        // console.log(chunks);
        const llmResult = await askLLM(message, chunks, history)

        const assistantMessage = await Message.create({
            notebookId,
            role: "assistant",
            content: llmResult.content,
            citations: llmResult.citations,
            sourceType: llmResult.sourceType,
        })

        return response.requestSuccessWithData(
            res,
            "berhasil kirim pesan",
            { userMessage, assistantMessage },
            200,
        )
    } catch (error) {
        console.error("[chat] sendMessage error:", error)
        return response.serverError(res, "Gagal mendapatkan jawaban, silakan coba lagi.")
    }
}

export const getMessages = async (req: Request, res: Response) => {
    try {
        const { notebookId } = req.params
        
        if (!notebookId || typeof notebookId !== "string") {
            return response.userError(res, "notebookId tidak valid")
        }

        const messages = await Message.find({ notebookId })
            .sort({ createdAt: 1 })
            .lean()

        return response.requestSuccessWithData(
            res,
            "berhasil dapet riwayat pesan",
            { messages },
            200,
        )
    } catch (error) {
        console.error("[chat] getMessages error:", error)
        return response.serverError(res, "Gagal memuat riwayat obrolan, silahkan muat ulang halaman")
    }
}

/** Maksimal chunk yang dikirim ke Gemini untuk ringkasan bab */
const MAX_SUMMARY_CHUNKS = 20

const buildSummarySourceBlock = (
    chunks: { pageStart: number; pageEnd: number; content: string }[],
    documentTitle: string,
): string =>
    chunks
        .map((c, i) => [
            `SOURCE [${i + 1}]`,
            `Document: ${documentTitle}`,
            `Pages: ${c.pageStart}–${c.pageEnd}`,
            `Content: "${c.content}"`,
        ].join("\n"))
        .join("\n\n")

const buildSummaryPrompt = (
    chapterTitle: string,
    pageStart: number,
    pageEnd: number,
    documentTitle: string,
    chunks: { pageStart: number; pageEnd: number; content: string }[],
): string => {
    const sourceBlock = buildSummarySourceBlock(chunks, documentTitle)
    return [
        sourceBlock,
        "",
        "---",
        `Buat ringkasan Bab "${chapterTitle}" (halaman ${pageStart}–${pageEnd}) dari dokumen "${documentTitle}" dalam 5 sampai 8 poin utama.`,
        "",
        "Aturan:",
        "- Setiap poin harus mewakili ide penting dari bab ini",
        "- Sertakan citation dengan format [1], [2], dst. di setiap poin",
        "- Jangan membuat citation di luar SOURCE yang diberikan",
        "- Gunakan Bahasa Indonesia",
    ].join("\n")
}

export const createChapterSummary = async (req: Request, res: Response) => {
    try {
        const userId = req.userId
        if (!userId) {
            return response.userError(res, "tidak terautentikasi", 401)
        }

        const { notebookId } = req.params
        if (!notebookId || typeof notebookId !== "string") {
            return response.userError(res, "notebookId tidak valid")
        }

        const { documentId, chapterTitle, pageStart, pageEnd } = req.body as {
            documentId: string
            chapterTitle: string
            pageStart: number
            pageEnd: number
        }

        // verify dokumen milik notebook ini
        const doc = await Document.findOne({
            _id: documentId,
            notebookId,
            parseStatus: "done",
        }).select("_id title")

        if (!doc) {
            return response.notFoundError(res, "dokumen tidak ditemukan atau belum selesai diproses")
        }

        // ambil chunks dalam rentang halaman bab
        const rawChunks = await Chunk.find({
            documentId: new mongoose.Types.ObjectId(documentId),
            pageStart: { $gte: pageStart },
            pageEnd: { $lte: pageEnd },
        })
            .select("pageStart pageEnd content")
            .sort({ pageStart: 1 })
            .limit(MAX_SUMMARY_CHUNKS)
            .lean()

        if (rawChunks.length === 0) {
            return response.userError(
                res,
                "Tidak ada konten pada rentang halaman ini",
                422,
            )
        }

        // simpan pesan user
        const userContent = `Buatkan ringkasan Bab ${chapterTitle} (hlm. ${pageStart}–${pageEnd}) dari ${doc.title}`
        const userMessage = await Message.create({
            notebookId,
            role: "user",
            content: userContent,
            citations: [],
            sourceType: null,
        })

        // bangun prompt ringkasan khusus
        const summaryPrompt = buildSummaryPrompt(
            chapterTitle,
            pageStart,
            pageEnd,
            doc.title,
            rawChunks,
        )

        // panggil Gemini tanpa history — ringkasan tidak butuh konteks percakapan
        const result = await summaryModel.generateContent(summaryPrompt)
        const responseText = result.response.text()

        // parse + re-number citations
        const citationRegex = /\[(\d+)\]/g
        const foundIndices = new Set<number>()
        let m: RegExpExecArray | null
        while ((m = citationRegex.exec(responseText)) !== null) {
            const raw = m[1]
            if (!raw) continue
            const idx = parseInt(raw, 10)
            if (idx >= 1 && idx <= rawChunks.length) foundIndices.add(idx)
        }

        const rawCitations = Array.from(foundIndices)
            .sort((a, b) => a - b)
            .map((oldIdx, i) => {
                const chunk = rawChunks[oldIdx - 1]!
                return {
                    oldIdx,
                    citation: {
                        citationIndex: i + 1,
                        documentId: doc._id as mongoose.Types.ObjectId,
                        documentTitle: doc.title,
                        pageStart: chunk.pageStart,
                        pageEnd: chunk.pageEnd,
                        chunkContent: chunk.content,
                    },
                }
            })

        let finalContent = responseText
        for (const { oldIdx, citation } of rawCitations) {
            finalContent = finalContent.replaceAll(`[${oldIdx}]`, `[__${citation.citationIndex}__]`)
        }
        finalContent = finalContent.replace(/\[__(\d+)__\]/g, "[$1]")

        const citations = rawCitations.map((r) => r.citation)

        const assistantMessage = await Message.create({
            notebookId,
            role: "assistant",
            content: finalContent,
            citations,
            sourceType: "document",
        })

        return response.requestSuccessWithData(
            res,
            "berhasil membuat ringkasan bab",
            { userMessage, assistantMessage },
            200,
        )
    } catch (error) {
        console.error("[chat] createChapterSummary error:", error)
        return response.serverError(res, "Gagal membuat ringkasan, silakan coba lagi.")
    }
}
