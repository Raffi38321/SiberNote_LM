import { z } from "zod";

export const messageSchema = {
    body: z.object({
        message: z.string().min(1,"Wajib, tidak boleh kosong"),
    })
}

export const summarySchema = {
    body: z.object({
        documentId: z.string().min(1, "documentId tidak boleh kosong"),
        chapterTitle: z.string().min(1, "chapterTitle tidak boleh kosong"),
        pageStart: z.number({ error: "pageStart harus angka" }).int().min(1, "pageStart minimal 1"),
        pageEnd: z.number({ error: "pageEnd harus angka" }).int().min(1, "pageEnd minimal 1"),
    }).refine((data) => data.pageEnd >= data.pageStart, {
        message: "pageEnd harus lebih besar atau sama dengan pageStart",
        path: ["pageEnd"],
    })
}
