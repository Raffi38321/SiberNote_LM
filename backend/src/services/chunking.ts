import { PDFParse } from "pdf-parse"
import { OfficeParser } from "officeparser"
import type { OfficeContentNode } from "officeparser"
import type { Types } from "mongoose"

const MAX_CHARS_PER_CHUNK = 3000

// ─── types ───────────────────────────────────────────────────────────────────

export interface RawChunk {
    documentId: Types.ObjectId
    chunkIndex: number
    content: string
    pageStart: number
    pageEnd: number
    embedding: number[]
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Pecah teks panjang jadi beberapa bagian tanpa motong di tengah kata.
 */
const splitBySize = (text: string): string[] => {
    const parts: string[] = []
    let start = 0

    while (start < text.length) {
        let end = start + MAX_CHARS_PER_CHUNK

        if (end < text.length) {
            // mundur sampai ketemu spasi agar tidak motong kata
            while (end > start && text[end] !== " ") end--
            if (end === start) end = start + MAX_CHARS_PER_CHUNK
        }

        const part = text.slice(start, end).trim()
        if (part.length > 0) parts.push(part)
        start = end + 1
    }

    return parts
}

/**
 * Konversi teks satu halaman/slide jadi satu atau beberapa RawChunk.
 * Halaman/slide kosong (< 20 karakter) di-skip.
 */
const pageToChunks = (
    text: string,
    pageNumber: number,
    documentId: Types.ObjectId,
    startIndex: number,
): RawChunk[] => {
    const trimmed = text.trim()
    if (trimmed.length < 20) return []

    const parts = trimmed.length > MAX_CHARS_PER_CHUNK
        ? splitBySize(trimmed)
        : [trimmed]

    return parts.map((content, i) => ({
        documentId,
        chunkIndex: startIndex + i,
        content,
        pageStart: pageNumber,
        pageEnd: pageNumber,
        embedding: [],
    }))
}

/**
 * Rekursif kumpulkan teks dari satu node AST beserta seluruh children-nya.
 * Pakai `node.text` kalau ada (sudah concatenated oleh officeparser),
 * fallback ke traverse manual lewat `children`.
 */
const extractTextFromNode = (node: OfficeContentNode): string => {
    if (node.text) return node.text

    const parts: string[] = []
    if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
            const t = extractTextFromNode(child)
            if (t) parts.push(t)
        }
    }
    return parts.join(" ").replace(/\s+/g, " ").trim()
}

// ─── PDF chunking ─────────────────────────────────────────────────────────────

export const chunkPDF = async (
    buffer: Buffer,
    documentId: Types.ObjectId,
): Promise<{ chunks: RawChunk[]; totalPages: number }> => {
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    await parser.destroy()

    const chunks: RawChunk[] = []
    let chunkIndex = 0

    for (const page of result.pages) {
        const pageChunks = pageToChunks(page.text, page.num, documentId, chunkIndex)
        chunks.push(...pageChunks)
        chunkIndex += pageChunks.length
    }

    return { chunks, totalPages: result.total }
}

// ─── PPTX chunking ────────────────────────────────────────────────────────────

export const chunkPPTX = async (
    buffer: Buffer,
    documentId: Types.ObjectId,
): Promise<{ chunks: RawChunk[]; totalPages: number }> => {
    // Buffer PPTX dideteksi otomatis via magic bytes oleh officeparser
    const ast = await OfficeParser.parseOffice(buffer)

    const chunks: RawChunk[] = []
    let chunkIndex = 0
    let totalSlides = 0

    for (const node of ast.content) {
        if (node.type !== "slide") continue

        totalSlides++
        const slideNumber = (node.metadata as { slideNumber?: number } | undefined)?.slideNumber ?? totalSlides

        const text = extractTextFromNode(node)
        const slideChunks = pageToChunks(text, slideNumber, documentId, chunkIndex)
        chunks.push(...slideChunks)
        chunkIndex += slideChunks.length
    }

    return { chunks, totalPages: totalSlides }
}
