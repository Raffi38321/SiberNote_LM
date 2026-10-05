import { PDFParse } from "pdf-parse"
import { OfficeParser } from "officeparser"
import type { ImageMetadata, OfficeAttachment, OfficeContentNode } from "officeparser"
import type { Types } from "mongoose"
import { generateEmbeddings } from "./embedding.js"
import { processPageTexts } from "./ocr.js"

const MAX_CHARS_PER_CHUNK = 3000
/** Minimal karakter OCR agar dianggap teks valid (bukan noise dari logo/ikon). */
const MIN_OCR_CHARS = 30

// ─── custom errors ────────────────────────────────────────────────────────────

/** Dilempar ketika dokumen berhasil diparsing tapi tidak mengandung teks sama sekali. */
export class NoTextError extends Error {
    constructor() {
        super("Tidak ada konten yang dapat diekstrak dari dokumen ini.")
        this.name = "NoTextError"
    }
}

/** Dilempar ketika file tidak bisa dibaca / corrupt. */
export class ParseError extends Error {
    constructor(cause?: unknown) {
        const detail = cause instanceof Error ? cause.message : String(cause)
        super(`Gagal memproses dokumen, silakan coba lagi. (${detail})`)
        this.name = "ParseError"
    }
}

// types

export interface RawChunk {
    documentId: Types.ObjectId
    chunkIndex: number
    content: string
    pageStart: number
    pageEnd: number
    embedding: number[]
}

const splitBySize = (text: string): string[] => {
    const parts: string[] = []
    let start = 0

    while (start < text.length) {
        let end = start + MAX_CHARS_PER_CHUNK

        if (end < text.length) {
            while (end > start && text[end] !== " ") end--
            if (end === start) end = start + MAX_CHARS_PER_CHUNK
        }

        const part = text.slice(start, end).trim()
        if (part.length > 0) parts.push(part)
        start = end + 1
    }

    return parts
}

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


const extractTextFromNode = (
    node: OfficeContentNode,
    attachmentsByName?: Map<string, OfficeAttachment>,
): string => {
    if (node.text) return node.text

    // gambar tertanam: ambil hasil OCR dari attachment (jika ada)
    if (node.type === "image" && attachmentsByName) {
        const name = (node.metadata as ImageMetadata | undefined)?.attachmentName
        const ocrText = name ? attachmentsByName.get(name)?.ocrText?.trim() : undefined
        if (ocrText && ocrText.length >= MIN_OCR_CHARS) return ocrText
        return ""
    }

    const parts: string[] = []
    if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
            const t = extractTextFromNode(child, attachmentsByName)
            if (t) parts.push(t)
        }
    }
    return parts.join(" ").replace(/\s+/g, " ").trim()
}
// embedding
const attachEmbeddings = async (chunks: RawChunk[]): Promise<RawChunk[]> => {
    if (chunks.length === 0) return chunks

    const texts = chunks.map((c) => c.content)
    const embeddings = await generateEmbeddings(texts)

    return chunks.map((chunk, i) => ({
        ...chunk,
        embedding: embeddings[i] ?? [],
    }))
}

export const chunkPDF = async (
    buffer: Buffer,
    documentId: Types.ObjectId,
): Promise<{ chunks: RawChunk[]; totalPages: number }> => {
    let parser: PDFParse | undefined
    try {
        parser = new PDFParse({ data: buffer })
        const result = await parser.getText()

        // hybrid routing: halaman teks normal pakai langsung,
        // halaman kosong/gambar/scan di-OCR lewat screenshot pdf-parse
        // (satu stack pdfjs — menghindari mismatch API vs Worker)
        const pageResults = await processPageTexts(result.pages, async (pageNumber) => {
            const shot = await parser!.getScreenshot({
                partial:      [pageNumber],
                scale:        2.0,
                imageBuffer:  true,
                imageDataUrl: false,
            })
            const page = shot.pages[0]
            if (!page?.data) {
                throw new Error(`screenshot halaman ${pageNumber} kosong`)
            }
            return Buffer.from(page.data)
        })

        const chunks: RawChunk[] = []
        let chunkIndex = 0

        for (const page of pageResults) {
            const pageChunks = pageToChunks(page.text, page.pageNumber, documentId, chunkIndex)
            chunks.push(...pageChunks)
            chunkIndex += pageChunks.length
        }

        if (chunks.length === 0) throw new NoTextError()

        const ocrCount  = pageResults.filter((p) => p.method === "ocr").length
        const textCount = pageResults.filter((p) => p.method === "text").length
        console.log(`[chunking] ${result.total} halaman — ${textCount} teks, ${ocrCount} OCR`)

        return { chunks: await attachEmbeddings(chunks), totalPages: result.total }
    } catch (err) {
        if (err instanceof NoTextError) throw err
        throw new ParseError(err)
    } finally {
        await parser?.destroy()
    }
}

export const chunkPPTX = async (
    buffer: Buffer,
    documentId: Types.ObjectId,
): Promise<{ chunks: RawChunk[]; totalPages: number }> => {
    try {
        // extractAttachments + ocr: OCR otomatis untuk gambar tertanam di slide
        const ast = await OfficeParser.parseOffice(buffer, {
            fileType: "pptx",
            extractAttachments: true,
            ocr: true,
            ocrConfig: { language: "ind+eng" },
        })

        const attachmentsByName = new Map<string, OfficeAttachment>(
            (ast.attachments ?? [])
                .filter((a) => a.name)
                .map((a) => [a.name, a]),
        )

        const ocrImageCount = (ast.attachments ?? []).filter(
            (a) => a.type === "image" && (a.ocrText?.trim().length ?? 0) >= MIN_OCR_CHARS,
        ).length

        const chunks: RawChunk[] = []
        let chunkIndex = 0
        let totalSlides = 0

        for (const node of ast.content) {
            if (node.type !== "slide") continue

            totalSlides++
            const slideNumber = (node.metadata as { slideNumber?: number } | undefined)?.slideNumber ?? totalSlides

            const text = extractTextFromNode(node, attachmentsByName)
            const slideChunks = pageToChunks(text, slideNumber, documentId, chunkIndex)
            chunks.push(...slideChunks)
            chunkIndex += slideChunks.length
        }

        if (chunks.length === 0) throw new NoTextError()

        console.log(`[chunking] ${totalSlides} slide — ${ocrImageCount} gambar di-OCR`)

        return { chunks: await attachEmbeddings(chunks), totalPages: totalSlides }
    } catch (err) {
        if (err instanceof NoTextError) throw err
        throw new ParseError(err)
    }
}
