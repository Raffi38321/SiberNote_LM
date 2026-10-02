import { PDFParse } from "pdf-parse"
import { OfficeParser } from "officeparser"
import type { OfficeContentNode } from "officeparser"
import type { Types } from "mongoose"
import { generateEmbeddings } from "./embedding.js"

const MAX_CHARS_PER_CHUNK = 3000

//types

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

    return { chunks: await attachEmbeddings(chunks), totalPages: result.total }
}

export const chunkPPTX = async (
    buffer: Buffer,
    documentId: Types.ObjectId,
): Promise<{ chunks: RawChunk[]; totalPages: number }> => {
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

    return { chunks: await attachEmbeddings(chunks), totalPages: totalSlides }
}
