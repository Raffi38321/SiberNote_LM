import { GoogleGenerativeAI, TaskType } from "@google/generative-ai"
import envVariable from "../utils/ENV.js"

const EMBEDDING_MODEL = "gemini-embedding-001"
export const EMBEDDING_DIMENSIONS = 3072

const BATCH_SIZE = 20
const BATCH_DELAY_MS = 15_000   
const RETRY_DELAY_MS = 65_000   
const MAX_RETRIES = 2

const genAI = new GoogleGenerativeAI(envVariable.GEMINI_EMBEDDING_KEY)
const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL })

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const is429 = (err: unknown): boolean => {
    if (typeof err !== "object" || err === null) return false
    const msg = (err as { message?: string }).message ?? ""
    return msg.includes("429") || msg.toLowerCase().includes("quota")
}

const embedBatchWithRetry = async (texts: string[], attempt = 0): Promise<number[][]> => {
    try {
        const requests = texts.map((text) => ({
            content: { role: "user", parts: [{ text }] },
            taskType: TaskType.RETRIEVAL_DOCUMENT,
        }))

        const result = await embeddingModel.batchEmbedContents({ requests })
        return result.embeddings.map((e) => e.values)
    } catch (err) {
        if (is429(err) && attempt < MAX_RETRIES) {
            console.warn(`[embedding] 429 rate limit — tunggu ${RETRY_DELAY_MS / 1000}s lalu retry (attempt ${attempt + 1}/${MAX_RETRIES})`)
            await sleep(RETRY_DELAY_MS)
            return embedBatchWithRetry(texts, attempt + 1)
        }
        throw err
    }
}

export const generateEmbeddings = async (texts: string[]): Promise<number[][]> => {
    if (texts.length === 0) return []

    const allEmbeddings: number[][] = []

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE)

        console.log(`[embedding] batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(texts.length / BATCH_SIZE)} — ${batch.length} chunks`)

        const embeddings = await embedBatchWithRetry(batch)
        allEmbeddings.push(...embeddings)

        if (i + BATCH_SIZE < texts.length) {
            await sleep(BATCH_DELAY_MS)
        }
    }

    return allEmbeddings
}

export const generateQueryEmbedding = async (text: string): Promise<number[]> => {
    const result = await embeddingModel.embedContent({
        content: { role: "user", parts: [{ text }] },
        taskType: TaskType.RETRIEVAL_QUERY,
    })

    return result.embedding.values
}
