import { GoogleGenerativeAI } from "@google/generative-ai"
import type { Types } from "mongoose"
import envVariable from "../utils/ENV.js"
import Chunk from "../models/chunk.model.js"

export interface FlashcardDocument {
    documentId: Types.ObjectId
    documentTitle: string
    totalPages: number
}

export interface ParsedCard {
    front: string
    back: string
    documentId: Types.ObjectId
    documentTitle: string
    pageStart: number
    pageEnd: number
}


const genAI = new GoogleGenerativeAI(envVariable.GEMINI_MODEL)
const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" })

const MAX_TOTAL_CHUNKS = 80

const fetchChunksSampled = async (
    docs: FlashcardDocument[],
): Promise<Map<string, { chunkIndex: number; pageStart: number; pageEnd: number; content: string }[]>> => {
    const map = new Map<string, { chunkIndex: number; pageStart: number; pageEnd: number; content: string }[]>()

    // pastikan tiap dokumen dapat minimal 1 slot
    const perDocSlots = Math.max(1, Math.floor(MAX_TOTAL_CHUNKS / docs.length))

    for (const doc of docs) {
        const total = await Chunk.countDocuments({ documentId: doc.documentId })

        let chunks: { chunkIndex: number; pageStart: number; pageEnd: number; content: string }[]

        if (total <= perDocSlots) {
            // ambil semua
            chunks = await Chunk.find({ documentId: doc.documentId })
                .select("chunkIndex pageStart pageEnd content")
                .sort({ chunkIndex: 1 })
                .lean()
        } else {
            // ambil dengan interval merata: step = floor(total / perDocSlots)
            const step = Math.floor(total / perDocSlots)
            const indices = Array.from({ length: perDocSlots }, (_, i) => i * step)

            // MongoDB tidak support offset per-index secara native,
            // ambil semua lalu filter by chunkIndex
            const allChunks = await Chunk.find({ documentId: doc.documentId })
                .select("chunkIndex pageStart pageEnd content")
                .sort({ chunkIndex: 1 })
                .lean()

            chunks = indices
                .map((idx) => allChunks[idx])
                .filter((c): c is NonNullable<typeof c> => c !== undefined)
        }

        map.set(doc.documentId.toString(), chunks)
    }

    return map
}

// ─── build prompt ─────────────────────────────────────────────────────────────

const buildFlashcardPrompt = (
    docs: FlashcardDocument[],
    chunksByDoc: Map<string, { pageStart: number; pageEnd: number; content: string }[]>,
    count: number,
): string => {
    const isMultiDoc = docs.length > 1

    const cardsPerDoc = distributeCards(count, docs.length)

    const docBlocks = docs.map((doc, i) => {
        const chunks = chunksByDoc.get(doc.documentId.toString()) ?? []
        const header = isMultiDoc
            ? `DOKUMEN ${i + 1}: ${doc.documentTitle} (${doc.totalPages} halaman)`
            : `Dokumen: ${doc.documentTitle} (${doc.totalPages} halaman)`

        const chunkLines = chunks.map(
            (c) => `[Halaman ${c.pageStart}–${c.pageEnd}]\n"${c.content.slice(0, 400)}"`,
        )

        const docCardCount = cardsPerDoc[i] ?? 1

        return [header, "", ...chunkLines, `\n→ Buat tepat ${docCardCount} kartu dari dokumen ini.`].join("\n")
    })

    const sourceBlock = docBlocks.join("\n\n---\n\n")

    const exampleCard = isMultiDoc
        ? `{ "front": "...", "back": "...", "documentTitle": "${docs[0]?.documentTitle ?? "Dokumen.pdf"}", "pageStart": 1, "pageEnd": 1 }`
        : `{ "front": "...", "back": "...", "documentTitle": "${docs[0]?.documentTitle ?? "Dokumen.pdf"}", "pageStart": 1, "pageEnd": 1 }`

    return [
        sourceBlock,
        "",
        "---",
        `Buat TEPAT ${count} flashcard dari dokumen di atas.`,
        "",
        "Aturan:",
        "- Sisi depan (front): pertanyaan atau istilah penting",
        "- Sisi belakang (back): jawaban atau penjelasan singkat, maksimal 3 kalimat",
        "- Pilih konsep paling penting dan BERAGAM dari seluruh dokumen, bukan hanya dari bagian awal",
        isMultiDoc
            ? `- Tiap dokumen harus punya minimal 1 kartu (distribusi: ${cardsPerDoc.map((n, i) => `${docs[i]?.documentTitle ?? `dok${i + 1}`}: ${n}`).join(", ")})`
            : "",
        `- Sertakan nama dokumen asli (bukan "DOKUMEN 1") dan nomor halaman sumber untuk setiap kartu`,
        "- Gunakan Bahasa Indonesia",
        "",
        `Return HANYA JSON array berisi tepat ${count} objek:`,
        `[${exampleCard}, ...]`,
    ]
        .filter((line) => line !== "")
        .join("\n")
}

const distributeCards = (total: number, numDocs: number): number[] => {
    const base = Math.floor(total / numDocs)
    const remainder = total % numDocs
    return Array.from({ length: numDocs }, (_, i) => base + (i < remainder ? 1 : 0))
}

const parseAndValidate = (
    raw: string,
    docs: FlashcardDocument[],
    expectedCount: number,
): ParsedCard[] => {
    const parsed = JSON.parse(raw) as unknown[]

    if (!Array.isArray(parsed)) throw new Error("Response bukan array")
    if (parsed.length !== expectedCount) {
        throw new Error(`Jumlah kartu tidak sesuai: expected ${expectedCount}, got ${parsed.length}`)
    }

    const docTitleToId = new Map(docs.map((d) => [d.documentTitle, d.documentId]))
    const validTitles = new Set(docs.map((d) => d.documentTitle))

    return parsed.map((item, i) => {
        if (typeof item !== "object" || item === null) throw new Error(`Item ${i} bukan object`)

        const c = item as Record<string, unknown>

        if (typeof c.front !== "string" || !c.front.trim()) throw new Error(`front kosong pada item ${i}`)
        if (typeof c.back !== "string" || !c.back.trim()) throw new Error(`back kosong pada item ${i}`)
        if (typeof c.documentTitle !== "string" || !c.documentTitle.trim()) throw new Error(`documentTitle kosong pada item ${i}`)
        if (typeof c.pageStart !== "number" || c.pageStart < 1) throw new Error(`pageStart tidak valid pada item ${i}`)
        if (typeof c.pageEnd !== "number" || c.pageEnd < c.pageStart) throw new Error(`pageEnd tidak valid pada item ${i}`)

        // fallback: kalau Gemini return "DOKUMEN 1" bukan nama file asli
        let resolvedTitle = c.documentTitle as string
        if (!validTitles.has(resolvedTitle)) {
            const match = /^DOKUMEN\s+(\d+)$/i.exec(resolvedTitle.trim())
            if (match) {
                const idx = parseInt(match[1]!, 10) - 1
                const fallback = docs[idx]
                if (fallback) resolvedTitle = fallback.documentTitle
            }
            // kalau masih tidak dikenal, fallback ke dokumen pertama
            if (!validTitles.has(resolvedTitle)) {
                resolvedTitle = docs[0]?.documentTitle ?? resolvedTitle
            }
        }

        const documentId = docTitleToId.get(resolvedTitle)
        if (!documentId) throw new Error(`documentTitle "${resolvedTitle}" tidak dikenal`)

        return {
            front: (c.front as string).trim(),
            back: (c.back as string).trim(),
            documentId,
            documentTitle: resolvedTitle,
            pageStart: c.pageStart as number,
            pageEnd: c.pageEnd as number,
        }
    })
}

const is503 = (err: unknown): boolean => {
    if (typeof err !== "object" || err === null) return false
    const status = (err as { status?: number }).status
    const msg = (err as { message?: string }).message ?? ""
    return status === 503 || msg.includes("503") || msg.toLowerCase().includes("high demand")
}

const generateWithRetry = async (prompt: string, attempt = 0): Promise<string> => {
    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
        })
        return result.response.text()
    } catch (err) {
        if (is503(err) && attempt < 3) {
            const delay = 10_000 * (attempt + 1)
            console.warn(`[flashcard] 503 — retry ${attempt + 1}/3 dalam ${delay / 1000}s`)
            await new Promise((resolve) => setTimeout(resolve, delay))
            return generateWithRetry(prompt, attempt + 1)
        }
        throw err
    }
}

// ─── main export ──────────────────────────────────────────────────────────────

/**
 * Generate set flashcard dari dokumen-dokumen yang dipilih.
 *
 * @param docs   - Dokumen yang dipilih user (sudah parseStatus: "done")
 * @param count  - Jumlah kartu yang diminta (3 / 5 / 7 / 10)
 * @returns      - Array ParsedCard siap simpan ke DB
 */
export const generateFlashcards = async (
    docs: FlashcardDocument[],
    count: number,
): Promise<ParsedCard[]> => {
    const chunksByDoc = await fetchChunksSampled(docs)
    const prompt = buildFlashcardPrompt(docs, chunksByDoc, count)

    // attempt 1
    let raw = await generateWithRetry(prompt)
    try {
        return parseAndValidate(raw, docs, count)
    } catch (firstErr) {
        console.warn("[flashcard] validasi gagal, retry generate:", (firstErr as Error).message)
    }

    // retry sekali
    raw = await generateWithRetry(prompt)
    return parseAndValidate(raw, docs, count)  // kalau masih gagal, throw → controller return 500
}
