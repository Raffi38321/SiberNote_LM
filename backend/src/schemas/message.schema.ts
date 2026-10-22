import { z } from "zod";

export const messageSchema = {
    body: z.object({
        message: z.string().min(1,"Wajib, tidak boleh kosong"),
    })
}
