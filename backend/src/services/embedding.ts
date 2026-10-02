import { GoogleGenerativeAI, TaskType } from "@google/generative-ai"
import envVariable from "../utils/ENV.js"

const EMBEDDING_MODEL = "gemini-embedding-001"
export const EMBEDDING_DIMENSIONS = 3072

const BATCH_SIZE = 100

const BATCH_DELAY_MS = 200


const genAI = new GoogleGenerativeAI(envVariable.GEMINI_EMBEDDING_KEY)
const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL })


const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Generate embedding untuk satu batch teks (max 100 item).
 */
const embedBatch = async (texts: string[]): Promise<number[][]> => {
    const requests = texts.map((text) => ({
        content: { role: "user", parts: [{ text }] },
        taskType: TaskType.RETRIEVAL_DOCUMENT,
    }))

    const result = await embeddingModel.batchEmbedContents({ requests })

    return result.embeddings.map((e) => e.values)
}

// exports 

/**
 * Generate embedding untuk array teks dalam jumlah berapapun.
 */
export const generateEmbeddings = async (texts: string[]): Promise<number[][]> => {
    if (texts.length === 0) return []

    const allEmbeddings: number[][] = []

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE)
        const embeddings = await embedBatch(batch)
        allEmbeddings.push(...embeddings)

        // jeda antar batch supaya ga limit
        if (i + BATCH_SIZE < texts.length) {
            await sleep(BATCH_DELAY_MS)
        }
    }

    return allEmbeddings
}

/**
 * Generate embedding untuk satu teks 
 */
export const generateQueryEmbedding = async (text: string): Promise<number[]> => {
    const result = await embeddingModel.embedContent({
        content: { role: "user", parts: [{ text }] },
        taskType: TaskType.RETRIEVAL_QUERY,
    })

    return result.embedding.values
}
