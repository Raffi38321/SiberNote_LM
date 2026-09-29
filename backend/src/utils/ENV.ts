import dotenv from "dotenv"

dotenv.config()

const envVariable: {
    PORT: number
    MONGO_URL: string
    JWT_KEY: string
    REFRESH_TOKEN_KEY: string
    CLOUDINARY_CLOUD_NAME: string
    CLOUDINARY_API_KEY: string
    CLOUDINARY_API_SECRET: string
} = {
    PORT: Number(process.env.PORT) || 8080,
    MONGO_URL: process.env.MONGO_URL || "",
    JWT_KEY: process.env.JWT_KEY || "ligma",
    REFRESH_TOKEN_KEY: process.env.REFRESH_TOKEN_KEY || "ligma_refresh",
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "",
}

export default envVariable
