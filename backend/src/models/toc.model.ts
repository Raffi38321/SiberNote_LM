import mongoose, { Schema, Types } from "mongoose"

interface IChapter {
    chapterNumber: number
    title: string
    pageStart: number
    pageEnd: number
    documentId: Types.ObjectId
    documentTitle: string
}

interface ITableOfContents {
    notebookId: Types.ObjectId
    chapters: IChapter[]
    generatedAt: Date
}

const chapterSchema = new Schema<IChapter>(
    {
        chapterNumber: { type: Number, required: true },
        title: { type: String, required: true },
        pageStart: { type: Number, required: true },
        pageEnd: { type: Number, required: true },
        documentId: { type: Schema.Types.ObjectId, ref: "Document", required: true },
        documentTitle: { type: String, required: true },
    },
    { _id: false },
)

const tocSchema = new Schema<ITableOfContents>(
    {
        notebookId: {
            type: Schema.Types.ObjectId,
            ref: "Notebook",
            required: true,
            unique: true,
        },
        chapters: { type: [chapterSchema], default: [] },
        generatedAt: { type: Date, required: true },
    },
    { timestamps: true },
)

const TableOfContents = mongoose.model<ITableOfContents>("TableOfContents", tocSchema)

export default TableOfContents
