import mongoose, { Schema, Types } from "mongoose"

interface IChunk {
    documentId: Types.ObjectId
    chunkIndex: number
    content: string
    pageStart: number
    pageEnd: number
    embedding: number[]
}

const chunkSchema = new mongoose.Schema<IChunk>(
    {
        documentId: {
            type: Schema.Types.ObjectId,
            ref: "Document",
            required: true,
        },
        chunkIndex: {
            type: Number,
            required: true,
        },
        content: {
            type: String,
            required: true,
        },
        pageStart: {
            type: Number,
            required: true,
        },
        pageEnd: {
            type: Number,
            required: true,
        },
        embedding: {
            type: [Number],
            default: [],
        },
    },
    {
        timestamps: true,
    }
)

// full-text search index pada content — dipakai saat retrieval RAG
chunkSchema.index({ content: "text" })
// compound index untuk query chunks by document secara efisien
chunkSchema.index({ documentId: 1, chunkIndex: 1 })

const Chunk = mongoose.model<IChunk>("Chunk", chunkSchema)

export default Chunk
