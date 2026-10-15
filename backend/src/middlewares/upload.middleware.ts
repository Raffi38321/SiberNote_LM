import multer from "multer"

const ALLOWED_DOCUMENT_MIME_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation", 
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",    
    "text/plain", 
]

const ALLOWED_AVATAR_MIME_TYPES = [
    "image/jpeg",
]

const MAX_DOCUMENT_SIZE_MB = 20
const MAX_AVATAR_SIZE_MB = 5

const storage = multer.memoryStorage()

export const uploadDocument = multer({
    storage,
    limits: {
        fileSize: MAX_DOCUMENT_SIZE_MB * 1024 * 1024,
    },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_DOCUMENT_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true)
        } else {
            cb(new Error("Format tidak didukung, hanya PDF, PPTX, DOCX, dan TXT"))
        }
    },
}).single("file")

export const uploadAvatar = multer({
    storage,
    limits: {
        fileSize: MAX_AVATAR_SIZE_MB * 1024 * 1024,
    },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_AVATAR_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true)
        } else {
            cb(new Error("Format foto profil harus JPG"))
        }
    },
}).single("avatar")
