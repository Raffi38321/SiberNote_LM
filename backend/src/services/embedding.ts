import { GoogleGenerativeAI, TaskType } from "@google/generative-ai"
import envVariable from "../utils/ENV.js"

// ─── config ───────────────────────────────────────────────────────────────────

// text-embedding-004 sudah tidak tersedia di v1beta
// gemini-embedding-001: 3072 dimensi, model resmi untuk RAG
const EMBEDDING_MODEL = "gemini-embedding-001"
export const EMBEDDING_DIMENSIONS = 3072

// Gemini free tier: 1500 RPM, tapi batchEmbedContents max 100 request per call
const BATCH_SIZE = 100

// jeda antar batch kalau ada banyak chunk (ms)
const BATCH_DELAY_MS = 200

// ─── client ──────────────────────────────────────────────────────────────────

const genAI = new GoogleGenerativeAI(envVariable.GEMINI_EMBEDDING_KEY)
const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL })

// ─── helpers ─────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Generate embedding untuk satu batch teks (max 100 item).
 * Pakai TaskType.RETRIEVAL_DOCUMENT karena chunks ini akan di-retrieve saat RAG.
 */
const embedBatch = async (texts: string[]): Promise<number[][]> => {
    const requests = texts.map((text) => ({
        content: { role: "user", parts: [{ text }] },
        taskType: TaskType.RETRIEVAL_DOCUMENT,
    }))

    const result = await embeddingModel.batchEmbedContents({ requests })

    return result.embeddings.map((e) => e.values)
}

// ─── exports ──────────────────────────────────────────────────────────────────

/**
 * Generate embedding untuk array teks dalam jumlah berapapun.
 * Otomatis dibagi jadi batch @BATCH_SIZE dengan jeda antar batch.
 * Return array embedding dengan urutan yang sama dengan input.
 */
export const generateEmbeddings = async (texts: string[]): Promise<number[][]> => {
    if (texts.length === 0) return []

    const allEmbeddings: number[][] = []

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE)
        const embeddings = await embedBatch(batch)
        allEmbeddings.push(...embeddings)

        // jeda antar batch untuk hindari rate limit, kecuali batch terakhir
        if (i + BATCH_SIZE < texts.length) {
            await sleep(BATCH_DELAY_MS)
        }
    }

    return allEmbeddings
}

/**
 * Generate embedding untuk satu teks (dipakai saat query/retrieval).
 * Pakai TaskType.RETRIEVAL_QUERY bukan DOCUMENT.
 */
export const generateQueryEmbedding = async (text: string): Promise<number[]> => {
    const result = await embeddingModel.embedContent({
        content: { role: "user", parts: [{ text }] },
        taskType: TaskType.RETRIEVAL_QUERY,
    })

    return result.embedding.values
}
