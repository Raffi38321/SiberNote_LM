import mongoose, { Schema, Types } from "mongoose"

interface IFlashcard {
    front: string
    back: string
    documentId: Types.ObjectId
    documentTitle: string
    pageStart: number
    pageEnd: number
}

interface IFlashcardSet {
    notebookId: Types.ObjectId
    documentIds: Types.ObjectId[]   // dokumen yang dipakai saat generate — untuk deteksi perubahan
    cards: IFlashcard[]
    generatedAt: Date
}

const flashcardSchema = new Schema<IFlashcard>(
    {
        front: { type: String, required: true },
        back: { type: String, required: true },
        documentId: { type: Schema.Types.ObjectId, ref: "Document", required: true },
        documentTitle: { type: String, required: true },
        pageStart: { type: Number, required: true },
        pageEnd: { type: Number, required: true },
    },
    { _id: false },
)

const flashcardSetSchema = new Schema<IFlashcardSet>(
    {
        notebookId: {
            type: Schema.Types.ObjectId,
            ref: "Notebook",
            required: true,
            unique: true,
        },
        documentIds: [{ type: Schema.Types.ObjectId, ref: "Document" }],
        cards: { type: [flashcardSchema], default: [] },
        generatedAt: { type: Date, required: true },
    },
    { timestamps: true },
)

const FlashcardSet = mongoose.model<IFlashcardSet>("FlashcardSet", flashcardSetSchema)

export default FlashcardSet
