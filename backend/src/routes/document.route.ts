import { Router } from "express"
import { uploadDocument, getDocumentsByNotebook, deleteDocument, updateDocument } from "../controllers/document.controller.js"
import { authenticate } from "../middlewares/auth.middleware.js"
import { handleDocumentUpload } from "../middlewares/handleDocument.middleware.js"
import { validateRequest } from "../middlewares/validateSchema.middelare.js"
import { updateDocumentSchema } from "../schemas/document.schem.js"

const documentRouter = Router()

documentRouter.use(authenticate)

documentRouter.post("/:notebookId", handleDocumentUpload, uploadDocument)
documentRouter.get("/:notebookId", getDocumentsByNotebook)
documentRouter.patch("/:documentId",validateRequest(updateDocumentSchema),updateDocument)
documentRouter.delete("/:documentId", deleteDocument)

export default documentRouter
