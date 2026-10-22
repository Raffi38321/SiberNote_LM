import { Router } from "express";
import { validateRequest } from "../middlewares/validateSchema.middelare.js";
import { messageSchema } from "../schemas/message.schema.js";
import { isDocumentOwner } from "../middlewares/authorize.middleware.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const chatRouter = Router()

chatRouter.post("/:notebookId",[authenticate,validateRequest(messageSchema),isDocumentOwner])
chatRouter.get("/:notebookId",[authenticate,isDocumentOwner])

export default chatRouter