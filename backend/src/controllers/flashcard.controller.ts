import type { Request, Response } from "express"
import mongoose from "mongoose"
import response from "../utils/response.js"
import Document from "../models/document.model.js"
import { generateFlashcards } from "../services/flashcard.js"
import type { FlashcardDocument } from "../services/flashcard.js"

const ALLOWED_COUNTS = [3, 5, 7, 10]

export const getFlashcards = async (req: Request, res: Response) => {
    try {
        const userId = req.userId
        if (!userId) {
            return response.userError(res, "tidak terautentikasi", 401)
        }

        const { notebookId } = req.params
        if (!notebookId || typeof notebookId !== "string") {
            return response.userError(res, "notebookId tidak valid")
        }

        const { documentIds, count } = req.body as {
            documentIds: string[]
            count: number
        }
        console.log(`[flashcard]`,documentIds);

        if (!ALLOWED_COUNTS.includes(count)) {
            return response.userError(
                res,
                `count harus salah satu dari: ${ALLOWED_COUNTS.join(", ")}`,
            )
        }

        if (!Array.isArray(documentIds) || documentIds.length === 0) {
            return response.userError(res, "documentIds harus array berisi minimal 1 ID")
        }

        const docs = await Document.find({
            _id: { $in: documentIds.map((id) => new mongoose.Types.ObjectId(id)) },
            notebookId,
            parseStatus: "done",
        }).select("_id title totalPages")

        if (docs.length === 0) {
            return response.userError(
                res,
                "belum ada dokumen yang selesai diproses di notebook ini",
                422,
            )
        }

        const selectedDocs = docs.slice(0, count)

        const flashcardDocs: FlashcardDocument[] = selectedDocs.map((d) => ({
            documentId: d._id as mongoose.Types.ObjectId,
            documentTitle: d.title,
            totalPages: d.totalPages,
        }))
        console.log(`[flashcard] generate`,documentIds);

        const cards = await generateFlashcards(flashcardDocs, count)
        console.log(`[flashcard] selesai generate`,documentIds);
        return response.requestSuccessWithData(
            res,
            "berhasil membuat flashcard",
            { cards },
            200,
        )
    } catch (error) {
        console.error("[flashcard] getFlashcards error:", error)
        return response.serverError(res, "Gagal membuat flashcard, silakan coba lagi.")
    }
}
