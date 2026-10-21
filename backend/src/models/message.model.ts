import mongoose, { Schema, Types } from "mongoose"

interface ICitation {
    citationIndex: number
    documentId: Types.ObjectId
    documentTitle: string
    pageStart: number
    pageEnd: number
    chunkContent: string
}

interface IMessage {
    notebookId: Types.ObjectId
    role: "user" | "assistant"
    content: string
    citations: ICitation[]
    sourceType: "document" | "web" | "mixed" | null
}

const citationSchema = new Schema<ICitation>(
    {
        citationIndex: { type: Number, required: true },
        documentId: { type: Schema.Types.ObjectId, ref: "Document", required: true },
        documentTitle: { type: String, required: true },
        pageStart: { type: Number, required: true },
        pageEnd: { type: Number, required: true },
        chunkContent: { type: String, required: true },
    },
    { _id: false },
)

const messageSchema = new Schema<IMessage>(
    {
        notebookId: {
            type: Schema.Types.ObjectId,
            ref: "Notebook",
            required: true,
        },
        role: {
            type: String,
            required: true,
            enum: ["user", "assistant"],
        },
        content: {
            type: String,
            required: true,
        },
        citations: {
            type: [citationSchema],
            default: [],
        },
        sourceType: {
            type: String,
            enum: ["document", "web", "mixed", null],
            default: null,
        },
    },
    { timestamps: true },
)

messageSchema.index({ notebookId: 1, createdAt: 1 })

const Message = mongoose.model<IMessage>("Message", messageSchema)

export default Message
