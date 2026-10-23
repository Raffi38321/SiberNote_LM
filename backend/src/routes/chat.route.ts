import { Router } from "express"
import { validateRequest } from "../middlewares/validateSchema.middelare.js"
import { messageSchema } from "../schemas/message.schema.js"
import { isUserAuthorize } from "../middlewares/authorize.middleware.js"
import { authenticate } from "../middlewares/auth.middleware.js"
import { sendMessage, getMessages } from "../controllers/chat.controller.js"

const chatRouter = Router()

chatRouter.use(authenticate)
chatRouter.get("/:notebookId", isUserAuthorize, getMessages)
chatRouter.post("/:notebookId", [isUserAuthorize, validateRequest(messageSchema)], sendMessage)

export default chatRouter
