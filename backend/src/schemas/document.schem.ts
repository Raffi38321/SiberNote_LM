import { z } from "zod";

export const updateDocumentSchema = {
    body: z.object({
        name: z.string().min(1,"judul tidak boleh kosong"),
    })
}
