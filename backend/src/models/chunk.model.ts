import mongoose, { Schema, Types } from "mongoose"
import { EMBEDDING_DIMENSIONS } from "../services/embedding.js"

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

chunkSchema.index({ content: "text" })
chunkSchema.index({ documentId: 1, chunkIndex: 1 })

const Chunk = mongoose.model<IChunk>("Chunk", chunkSchema)

export default Chunk

export const ensureVectorSearchIndex = async (): Promise<void> => {
    try {
        const db = mongoose.connection.db
        if (!db) return

        await db.command({
            createSearchIndexes: "chunks",
            indexes: [
                {
                    name: "chunks_vector_index",
                    type: "vectorSearch",
                    definition: {
                        fields: [
                            {
                                type: "vector",
                                path: "embedding",
                                numDimensions: EMBEDDING_DIMENSIONS,  
                                similarity: "cosine",
                            },
                            {
                                type: "filter",
                                path: "documentId",
                            },
                        ],
                    },
                },
            ],
        })

        console.log("[atlas] vector search index 'chunks_vector_index' berhasil dibuat")
    } catch (error: unknown) {
        if (
            typeof error === "object" &&
            error !== null &&
            "codeName" in error &&
            (error as { codeName: string }).codeName === "IndexAlreadyExists"
        ) {
            console.log("[atlas] vector search index sudah ada, skip")
            return
        }
        console.warn("[atlas] gagal buat vector search index:", (error as Error).message ?? error)
    }
}
