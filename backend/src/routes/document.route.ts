import { Router } from "express"
import { uploadDocument, getDocumentsByNotebook, deleteDocument, updateDocument, getDocumentStatus, 
    // getCitationsByDocument 
} from "../controllers/document.controller.js"
import { authenticate } from "../middlewares/auth.middleware.js"
import { isDocumentOwner } from "../middlewares/authorize.middleware.js"
import { handleDocumentUpload } from "../middlewares/handleDocument.middleware.js"
import { validateRequest } from "../middlewares/validateSchema.middelare.js"
import { updateDocumentSchema } from "../schemas/document.schema.js"

const documentRouter = Router()

documentRouter.use(authenticate)

documentRouter.post("/:notebookId", handleDocumentUpload, uploadDocument)
documentRouter.get("/status/:documentId", getDocumentStatus)
// documentRouter.get("/:documentId/citations", isDocumentOwner, getCitationsByDocument)
documentRouter.get("/:notebookId", getDocumentsByNotebook)
documentRouter.patch("/:documentId", validateRequest(updateDocumentSchema), isDocumentOwner, updateDocument)
documentRouter.delete("/:documentId", isDocumentOwner, deleteDocument)

export default documentRouter
