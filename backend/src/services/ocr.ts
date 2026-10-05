import { createWorker } from "tesseract.js"

// ─── threshold deteksi ────────────────────────────────────────────────────────

/**
 * Kalau teks per halaman kurang dari ini, halaman dianggap gambar/scan
 * dan akan diproses lewat OCR.
 */
const MIN_CHARS_FOR_TEXT_PAGE = 30

// ─── OCR satu image buffer ────────────────────────────────────────────────────

/**
 * Jalankan Tesseract OCR pada image buffer.
 * Return teks hasil OCR, atau string kosong kalau gagal.
 */
export async function ocrImageBuffer(imageBuffer: Buffer): Promise<string> {
    const worker = await createWorker("ind+eng", undefined, {
        // matikan logging tesseract supaya tidak noise di console
        logger: () => {},
        errorHandler: () => {},
    })

    try {
        const { data } = await worker.recognize(imageBuffer)
        return data.text.trim()
    } finally {
        await worker.terminate()
    }
}

// ─── OCR seluruh PDF (per halaman) ───────────────────────────────────────────

export interface OcrPageResult {
    pageNumber: number
    text:       string
    method:     "text" | "ocr"  // apakah teks dari pdf-parse atau dari OCR
}

/**
 * Render satu halaman PDF ke PNG buffer.
 * Diimplementasikan di caller (pakai pdf-parse.getScreenshot) supaya
 * versi pdfjs API dan worker selalu cocok.
 */
export type RenderPageFn = (pageNumber: number) => Promise<Buffer>

/**
 * Terima array text per halaman dari pdf-parse,
 * dan fungsi render untuk halaman yang perlu OCR.
 *
 * Untuk setiap halaman:
 * - Kalau teks >= MIN_CHARS_FOR_TEXT_PAGE → pakai teks asli (method: "text")
 * - Kalau teks < MIN_CHARS_FOR_TEXT_PAGE  → render ke image → OCR (method: "ocr")
 *
 * Urutan halaman dijaga persis sesuai dokumen asli.
 */
export async function processPageTexts(
    pages: Array<{ num: number; text: string }>,
    renderPage: RenderPageFn,
): Promise<OcrPageResult[]> {
    const results: OcrPageResult[] = []

    for (const page of pages) {
        const trimmed = page.text.trim()

        if (trimmed.length >= MIN_CHARS_FOR_TEXT_PAGE) {
            // halaman teks normal — pakai langsung
            results.push({
                pageNumber: page.num,
                text:       trimmed,
                method:     "text",
            })
            continue
        }

        // halaman kosong / gambar / scan — coba OCR
        try {
            const imageBuffer = await renderPage(page.num)
            const ocrText     = await ocrImageBuffer(imageBuffer)

            if (ocrText.length >= MIN_CHARS_FOR_TEXT_PAGE) {
                results.push({
                    pageNumber: page.num,
                    text:       ocrText,
                    method:     "ocr",
                })
            }
            // kalau OCR juga kosong → skip halaman ini (gambar dekoratif / blank)
        } catch (err) {
            // OCR gagal untuk halaman ini → log dan lanjut, tidak crash
            console.warn(`[ocr] halaman ${page.num} gagal di-OCR:`, (err as Error).message)
        }
    }

    return results
}
