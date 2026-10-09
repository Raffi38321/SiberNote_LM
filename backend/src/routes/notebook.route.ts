import { Router } from "express";
import { createNotebook, deleteNotebook, getAllNotebookUser, getNotebookById, pinNotebook, updateNotebook } from "../controllers/notebook.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { validateRequest } from "../middlewares/validateSchema.middelare.js";
import { notebookSchema, pinNotebookSchema, updateNotebookSchema } from "../schemas/notebook.schema.js";
import { isUserAuthorize } from "../middlewares/authorize.middleware.js";

const notebookRouter = Router()

notebookRouter.use(authenticate)
notebookRouter.post("/", [validateRequest(notebookSchema)], createNotebook)
notebookRouter.get("/", getAllNotebookUser)
notebookRouter.delete("/:notebookId", isUserAuthorize, deleteNotebook)
notebookRouter.get("/:notebookId", isUserAuthorize, getNotebookById)
notebookRouter.put("/:notebookId", [validateRequest(updateNotebookSchema), isUserAuthorize], updateNotebook)
notebookRouter.patch("/:notebookId/pin", [validateRequest(pinNotebookSchema), isUserAuthorize], pinNotebook)

export default notebookRouter