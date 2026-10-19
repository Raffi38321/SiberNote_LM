import { z } from "zod"

export const noteSchema = {
    body: z.object({
        title: z.string().min(1,"Judul catatan wajib diisi min 1 karakter").max(100,"Judul catatan max 100 karakter"),
        content: z.string()
    })
}

export const updateNoteSchema = {
    body: z.object({
        title: z.string().min(1,"Judul catatan wajib diisi min 1 karakter").max(100,"Judul catatan max 100 karakter").optional(),
        content: z.string().optional()
    })
}