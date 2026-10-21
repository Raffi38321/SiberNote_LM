import dotenv from "dotenv"

dotenv.config()

const envVariable: {
    PORT: number
    MONGO_URL: string
    JWT_KEY: string
    REFRESH_TOKEN_KEY: string
    GEMINI_EMBEDDING_KEY: string
    /** URL publik ke folder uploads, misal: https://yourdomain.com/uploads */
    UPLOAD_BASE_URL: string
    /** Path absolut di server tempat file disimpan, misal: /var/www/sibernote/uploads */
    UPLOADS_DIR: string
    CLOUDINARY_API_SECRET: string
    CLOUDINARY_API_KEY: string
    CLOUDINARY_CLOUD_NAME: string
    GEMINI_MODEL:string
} = {
    PORT: Number(process.env.PORT) || 8080,
    MONGO_URL: process.env.MONGO_URL || "",
    JWT_KEY: process.env.JWT_KEY || "ligma",
    REFRESH_TOKEN_KEY: process.env.REFRESH_TOKEN_KEY || "ligma_refresh",
    GEMINI_EMBEDDING_KEY: process.env.GEMINI_EMBEDDING_KEY || "",
    UPLOAD_BASE_URL: process.env.UPLOAD_BASE_URL || "http://localhost:8080/uploads",
    UPLOADS_DIR: process.env.UPLOADS_DIR || "./uploads",
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME||"",
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY||"",
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET||"",
    GEMINI_MODEL: process.env.GEMINI_MODEL||""
}

export default envVariable
