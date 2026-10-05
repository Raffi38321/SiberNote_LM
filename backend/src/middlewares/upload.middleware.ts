import multer from "multer"

const ALLOWED_MIME_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation", // pptx
]

// Cloudinary free plan limit = 10MB per file
const MAX_FILE_SIZE_MB = 10

const storage = multer.memoryStorage()

export const uploadDocument = multer({
    storage,
    limits: {
        fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
    },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true)
        } else {
            cb(new Error("hanya file PDF dan PPTX yang diizinkan"))
        }
    },
}).single("file")
