import { z } from "zod";

export const updateDocumentSchema = {
    body: z.object({
        name: z.string().min(1,"judul tidak boleh kosong").max(100,"Judul catatan max 100 karakter"),
    }),
    params: z.object({
        documentId: z.string().min(1,"document id tidak boleh kosong")
    })
}
