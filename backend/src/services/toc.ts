import { GoogleGenerativeAI } from "@google/generative-ai"
import type { Types } from "mongoose"
import envVariable from "../utils/ENV.js"
import Chunk from "../models/chunk.model.js"

// ─── types ────────────────────────────────────────────────────────────────────

export interface TocDocument {
    documentId: Types.ObjectId
    documentTitle: string
    totalPages: number
}

export interface ParsedChapter {
    chapterNumber: number
    title: string
    pageStart: number
    pageEnd: number
    documentId: Types.ObjectId
    documentTitle: string
}

// ─── setup ────────────────────────────────────────────────────────────────────

const genAI = new GoogleGenerativeAI(envVariable.GEMINI_MODEL)
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

/** Maksimal chunk yang dikirim ke Gemini — batasi token */
const MAX_CHUNKS = 100

// ─── build prompt ─────────────────────────────────────────────────────────────

const buildTocPrompt = (
    docs: TocDocument[],
    chunksByDoc: Map<string, { pageStart: number; pageEnd: number; content: string }[]>,
): string => {
    const isMultiDoc = docs.length > 1

    const docBlocks = docs.map((doc, i) => {
        const chunks = chunksByDoc.get(doc.documentId.toString()) ?? []
        const header = isMultiDoc
            ? `DOKUMEN ${i + 1}: ${doc.documentTitle} (${doc.totalPages} halaman)`
            : `Dokumen: ${doc.documentTitle} (${doc.totalPages} halaman)`

        const chunkLines = chunks.map(
            (c) => `[Halaman ${c.pageStart}–${c.pageEnd}]\n"${c.content.slice(0, 400)}"`,
        )

        return [header, "", ...chunkLines].join("\n")
    })

    const sourceBlock = docBlocks.join("\n\n---\n\n")

    const returnExample = isMultiDoc
        ? `[
  { "chapterNumber": 1, "title": "Pendahuluan", "pageStart": 1, "pageEnd": 10, "documentTitle": "${docs[0]?.documentTitle ?? "Dokumen.pdf"}" },
  { "chapterNumber": 1, "title": "Pengenalan Jaringan", "pageStart": 1, "pageEnd": 15, "documentTitle": "${docs[1]?.documentTitle ?? "Dokumen2.pdf"}" }
]`
        : `[
  { "chapterNumber": 1, "title": "Pendahuluan", "pageStart": 1, "pageEnd": 10 },
  { "chapterNumber": 2, "title": "Normalisasi", "pageStart": 11, "pageEnd": 30 }
]`

    const docInstruction = isMultiDoc
        ? "Susun daftar bab dari semua dokumen di atas. Sertakan nama dokumen asal untuk setiap bab."
        : "Susun daftar bab dari dokumen di atas."

    return [
        sourceBlock,
        "",
        "---",
        docInstruction,
        "",
        "Aturan:",
        "- Jika dokumen memiliki halaman daftar isi, gunakan informasi dari sana.",
        "- Jika tidak ada halaman daftar isi, identifikasi bab berdasarkan struktur dan isi dokumen.",
        "- Gunakan Bahasa Indonesia untuk judul bab.",
        isMultiDoc ? "- Sertakan field \"documentTitle\" sesuai nama dokumen asal." : "",
        "",
        "Return HANYA JSON array, tanpa teks lain:",
        returnExample,
    ]
        .filter((line) => line !== null)
        .join("\n")
}

// ─── fetch chunks ─────────────────────────────────────────────────────────────

const fetchChunksForDocs = async (
    docs: TocDocument[],
): Promise<Map<string, { pageStart: number; pageEnd: number; content: string }[]>> => {
    const perDocLimit = Math.max(1, Math.floor(MAX_CHUNKS / docs.length))
    const map = new Map<string, { pageStart: number; pageEnd: number; content: string }[]>()

    for (const doc of docs) {
        const total = await Chunk.countDocuments({ documentId: doc.documentId })

        let chunks: { pageStart: number; pageEnd: number; content: string }[]

        if (total <= perDocLimit) {
            chunks = await Chunk.find({ documentId: doc.documentId })
                .select("pageStart pageEnd content")
                .sort({ chunkIndex: 1 })
                .lean()
        } else {
            // ambil chunk awal lebih banyak — daftar isi biasanya di awal dokumen
            // 70% dari slot untuk awal, 30% untuk sisa dokumen
            const frontSlots = Math.ceil(perDocLimit * 0.7)
            const tailSlots = perDocLimit - frontSlots

            const frontChunks = await Chunk.find({ documentId: doc.documentId })
                .select("pageStart pageEnd content")
                .sort({ chunkIndex: 1 })
                .limit(frontSlots)
                .lean()

            const tailChunks = await Chunk.find({ documentId: doc.documentId })
                .select("pageStart pageEnd content")
                .sort({ chunkIndex: -1 })
                .limit(tailSlots)
                .lean()

            // gabung dan sort ascending
            const combined = [...frontChunks, ...tailChunks]
            const unique = combined.filter(
                (c, i, arr) =>
                    arr.findIndex((x) => x.pageStart === c.pageStart && x.pageEnd === c.pageEnd) === i,
            )
            chunks = unique.sort((a, b) => a.pageStart - b.pageStart)
        }

        map.set(doc.documentId.toString(), chunks)
    }

    return map
}

// ─── parse + validate response ────────────────────────────────────────────────

const parseAndValidate = (
    raw: string,
    docs: TocDocument[],
): ParsedChapter[] => {
    const parsed = JSON.parse(raw) as unknown[]

    if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("Response bukan array atau kosong")
    }

    const docTitleToId = new Map(docs.map((d) => [d.documentTitle, d.documentId]))
    const isMultiDoc = docs.length > 1

    return parsed.map((item, i) => {
        if (typeof item !== "object" || item === null) {
            throw new Error(`Item ke-${i} bukan object`)
        }

        const c = item as Record<string, unknown>

        if (
            typeof c.chapterNumber !== "number" ||
            typeof c.title !== "string" || !c.title.trim() ||
            typeof c.pageStart !== "number" ||
            typeof c.pageEnd !== "number" ||
            c.pageStart < 1 ||
            c.pageEnd < c.pageStart
        ) {
            throw new Error(`Field tidak valid pada item ke-${i}`)
        }

        let documentId: Types.ObjectId
        let documentTitle: string

        if (isMultiDoc) {
            if (typeof c.documentTitle !== "string" || !c.documentTitle.trim()) {
                throw new Error(`documentTitle kosong pada item ke-${i}`)
            }
            const id = docTitleToId.get(c.documentTitle)
            if (!id) {
                throw new Error(`documentTitle "${c.documentTitle}" tidak dikenal`)
            }
            documentId = id
            documentTitle = c.documentTitle
        } else {
            const singleDoc = docs[0]
            if (!singleDoc) throw new Error("Tidak ada dokumen")
            documentId = singleDoc.documentId
            documentTitle = singleDoc.documentTitle
        }

        return {
            chapterNumber: c.chapterNumber,
            title: c.title.trim(),
            pageStart: c.pageStart,
            pageEnd: c.pageEnd,
            documentId,
            documentTitle,
        }
    })
}

// ─── main export ──────────────────────────────────────────────────────────────

/**
 * Generate daftar bab dari dokumen-dokumen di notebook.
 * Kirim chunks ke Gemini dengan Structured Output, parse hasilnya.
 */
export const generateToc = async (docs: TocDocument[]): Promise<ParsedChapter[]> => {
    const chunksByDoc = await fetchChunksForDocs(docs)
    const prompt = buildTocPrompt(docs, chunksByDoc)

    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
    })

    const raw = result.response.text()
    return parseAndValidate(raw, docs)
}
