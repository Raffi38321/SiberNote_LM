import { z } from "zod"

const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/

export const registerSchema = {
    body: z.object({
        username: z
            .string()
            .min(1, "username tidak boleh kosong")
            .max(16, "username maksimal 16 karakter")
            .regex(USERNAME_REGEX, "username hanya boleh huruf, angka, underscore(_), dan strip(-)"),
        email: z.email("format email tidak valid"),
        password: z
            .string()
            .min(8, "password minimal 8 karakter")
            .max(16, "password maksimal 16 karakter")
    })
    .superRefine((data, ctx) => {
        if (data.password.toLowerCase()=== data.username.toLowerCase()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "password tidak boleh sama dengan username",
                path: ["password"],
            })
        }
    })
}

export const loginSchema = {
    body: z.object({
        email: z.email("format email tidak valid"),
        password: z.string().min(1, "password tidak boleh kosong"),
    })
}
