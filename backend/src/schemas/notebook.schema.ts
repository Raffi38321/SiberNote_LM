import { z } from "zod";

export const notebookSchema = {
    body: z.object({
        title: z.string(),
        description: z.string()
    })
}
