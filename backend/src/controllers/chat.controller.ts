import type { Request, Response } from "express"
import mongoose from "mongoose"
import response from "../utils/response.js"
import Message from "../models/message.model.js"
import Document from "../models/document.model.js"
import Chunk from "../models/chunk.model.js"
import { generateQueryEmbedding } from "../services/embedding.js"
import { askLLM } from "../services/LLM.js"
import type { RetrievedChunk, ChatHistoryEntry } from "../services/LLM.js"

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
        console.log(chunks);
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