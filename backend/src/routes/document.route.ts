import { Router, type Request, type Response } from "express"
import { uploadDocument, getDocumentsByNotebook, deleteDocument, updateDocument, getDocumentStatus } from "../controllers/document.controller.js"
import { authenticate } from "../middlewares/auth.middleware.js"
import { handleDocumentUpload } from "../middlewares/handleDocument.middleware.js"
import { validateRequest } from "../middlewares/validateSchema.middelare.js"
import { updateDocumentSchema } from "../schemas/document.schema.js"
import Chunk from "../models/chunk.model.js"

const documentRouter = Router()

documentRouter.use(authenticate)

documentRouter.post("/:notebookId", handleDocumentUpload, uploadDocument)
documentRouter.get("/:notebookId", getDocumentsByNotebook)
documentRouter.get("/status/:documentId", getDocumentStatus)
documentRouter.patch("/:documentId",validateRequest(updateDocumentSchema),updateDocument)
documentRouter.delete("/:documentId", deleteDocument)
// documentRouter.get("/:documentId/chunk",async(req:Request,res:Response)=>{
//     try {
//         const {documentId} = req.params
//         const chunks = await Chunk.find({documentId})
//         res.status(200).json({
//             data:chunks
//         })

//     } catch (error) {
//         res.status(500).json({
//             status:"failed"
//         })
//     }
// })


export default documentRouter
