import { GoogleGenerativeAI } from "@google/generative-ai"
import type { Types } from "mongoose"
import envVariable from "../utils/ENV.js"

export interface RetrievedChunk {
    documentId: Types.ObjectId
    documentTitle: string
    pageStart: number
    pageEnd: number
    content: string
    score: number
}

export interface ChatHistoryEntry {
    role: "user" | "assistant"
    content: string
}

export interface ParsedCitation {
    citationIndex: number
    documentId: Types.ObjectId
    documentTitle: string
    pageStart: number
    pageEnd: number
    chunkContent: string
}

export interface LLMResult {
    content: string
    citations: ParsedCitation[]
    sourceType: "document" | "ai" | "mixed"
}

const genAI = new GoogleGenerativeAI(envVariable.GEMINI_MODEL)
const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" })

const buildSourceBlock = (chunks: RetrievedChunk[]): string => {
    if (chunks.length === 0) return ""

    return chunks
        .map((chunk, i) => {
            const index = i + 1
            return [
                `SOURCE [${index}]`,
                `Document: ${chunk.documentTitle}`,
                `Pages: ${chunk.pageStart}–${chunk.pageEnd}`,
                `Content: "${chunk.content}"`,
            ].join("\n")
        })
        .join("\n\n")
}

const buildPrompt = (question: string, chunks: RetrievedChunk[]): string => {
    if (chunks.length === 0) {
        return [
            "Tidak ada dokumen yang relevan ditemukan untuk pertanyaan ini.",
            "Jawab dari pengetahuan umum kamu dan tandai setiap klaim dengan [AI].",
            "",
            `Pertanyaan: ${question}`,
        ].join("\n")
    }

    const sourceBlock = buildSourceBlock(chunks)

    return [
        sourceBlock,
        "",
        "---",
        "Jawab pertanyaan di bawah HANYA berdasarkan SOURCE di atas.",
        "Sertakan citation dengan format [1], [2], dst. di setiap klaim.",
        "Jika ada informasi yang tidak ada di SOURCE, tambahkan dari pengetahuan umum dan tandai dengan [AI].",
        "Jangan membuat citation yang tidak tersedia dalam SOURCE.",
        "Gunakan Bahasa Indonesia.",
        "",
        `Pertanyaan: ${question}`,
    ].join("\n")
}

const toGeminiHistory = (history: ChatHistoryEntry[]) =>
    history.map((entry) => ({
        role: entry.role === "assistant" ? "model" : "user",
        parts: [{ text: entry.content }],
    }))

const MAX_CITATIONS = 5

const parseCitations = (
    responseText: string,
    chunks: RetrievedChunk[],
): ParsedCitation[] => {
    const found = new Set<number>()
    const regex = /\[(\d+)\]/g
    let match: RegExpExecArray | null

    while ((match = regex.exec(responseText)) !== null) {
        const raw = match[1]
        if (!raw) continue
        const index = parseInt(raw, 10)
        if (index >= 1 && index <= chunks.length) {
            found.add(index)
        }
    }

    // map ke chunk, sort by score descending (paling relevan duluan)
    const candidates = Array.from(found)
        .flatMap((citationIndex) => {
            const chunk = chunks[citationIndex - 1]
            if (!chunk) return []
            return [{ citationIndex, chunk }]
        })
        .sort((a, b) => b.chunk.score - a.chunk.score)

    // deduplikasi: buang yang punya documentId + pageStart sama, ambil yang score tertinggi
    const seen = new Set<string>()
    const deduplicated = candidates.filter(({ chunk }) => {
        const key = `${chunk.documentId.toString()}:${chunk.pageStart}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })

    // ambil max 5, kembalikan dengan citationIndex asli (urutan di prompt)
    return deduplicated
        .slice(0, MAX_CITATIONS)
        .sort((a, b) => a.citationIndex - b.citationIndex)
        .map(({ citationIndex, chunk }) => ({
            citationIndex,
            documentId: chunk.documentId,
            documentTitle: chunk.documentTitle,
            pageStart: chunk.pageStart,
            pageEnd: chunk.pageEnd,
            chunkContent: chunk.content,
        }))
}

/**
 * Tentukan sourceType dari jawaban dan citations.
 * - "document" → ada citation dari dokumen, tidak ada [AI]
 * - "ai"       → tidak ada citation dokumen sama sekali, jawaban dari pengetahuan AI
 * - "mixed"    → ada citation dokumen DAN ada [AI]
 */
const determineSourceType = (
    responseText: string,
    citations: ParsedCitation[],
): "document" | "ai" | "mixed" => {
    const hasDocumentSource = citations.length > 0
    const hasAiSource = /\[AI\]/i.test(responseText)

    if (hasDocumentSource && hasAiSource) return "mixed"
    if (hasDocumentSource) return "document"
    return "ai"
}

// ─── main export ──────────────────────────────────────────────────────────────

/**
 * Jalankan pipeline RAG ke Gemini.
 *
 * @param question   - Pertanyaan user
 * @param chunks     - Hasil vector search (bisa array kosong kalau tidak ada dokumen relevan)
 * @param history    - N pesan terakhir untuk konteks multi-turn (user + assistant bergantian)
 * @returns          - Jawaban Gemini + citations + sourceType siap simpan ke DB
 */
export const askLLM = async (
    question: string,
    chunks: RetrievedChunk[],
    history: ChatHistoryEntry[],
): Promise<LLMResult> => {
    const prompt = buildPrompt(question, chunks)

    const chat = model.startChat({
        history: toGeminiHistory(history),
    })

    const result = await chat.sendMessage(prompt)
    const responseText = result.response.text()

    const citations = parseCitations(responseText, chunks)
    const sourceType = determineSourceType(responseText, citations)

    return {
        content: responseText,
        citations,
        sourceType,
    }
}
