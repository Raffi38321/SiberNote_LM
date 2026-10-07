import { z } from "zod"

export const noteSchema = {
    body: z.object({
        title: z.string(),
        content: z.string()
    })
}