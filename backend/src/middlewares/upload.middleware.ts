import fs from "fs"
import path from "path"
import multer from "multer"
import envVariable from "../utils/ENV.js"

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

// Pastikan direktori ada sebelum multer menulis ke sana
const ensureDir = (dirPath: string) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true })
    }
}

const documentStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        // Folder akhir ditentukan saat upload di controller karena butuh userId & notebookId.
        // Di sini kita pakai folder sementara; controller akan memindahkan file ke path final.
        // Supaya simpel, kita tetap pakai memoryStorage khusus dokumen dan simpan di controller.
        cb(null, "")
    },
    filename: (_req, file, cb) => {
        cb(null, file.originalname)
    },
})

// Dokumen tetap pakai memoryStorage supaya controller bisa menentukan sub-folder
// berdasarkan userId & notebookId (yang baru tersedia di request setelah auth middleware).
const documentMemoryStorage = multer.memoryStorage()

const avatarStorage = multer.diskStorage({
    destination: (req, _file, cb) => {
        const userId = (req as any).userId ?? "unknown"
        const dir = path.join(envVariable.UPLOADS_DIR, "avatars", userId)
        ensureDir(dir)
        cb(null, dir)
    },
    filename: (_req, _file, cb) => {
        // Nama tetap "avatar.jpg" agar selalu overwrite file lama
        cb(null, "avatar.jpg")
    },
})

export const uploadDocument = multer({
    storage: documentMemoryStorage,
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
    storage: avatarStorage,
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
