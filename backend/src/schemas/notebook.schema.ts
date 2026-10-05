import { z } from "zod";

export const notebookSchema = {
    body: z.object({
        title: z.string()
            .min(1, "title tidak boleh kosong")
            .max(100, "title maksimal 100 karakter"),
        description: z.string()
    })
}
