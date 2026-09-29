import { Router } from "express"
import { uploadDocument, getDocumentsByNotebook, deleteDocument } from "../controllers/document.controller.js"
import { authenticate } from "../middlewares/auth.middleware.js"
import { uploadDocument as multerUpload } from "../middlewares/upload.middleware.js"

const documentRouter = Router()

// semua endpoint butuh autentikasi
documentRouter.use(authenticate)

// POST   /documents/:notebookId       — upload dokumen ke notebook
// GET    /documents/:notebookId       — get semua dokumen di notebook
// DELETE /documents/:documentId       — hapus dokumen

documentRouter.post("/:notebookId", multerUpload, uploadDocument)
documentRouter.get("/:notebookId", getDocumentsByNotebook)
documentRouter.delete("/:documentId", deleteDocument)

export default documentRouter
