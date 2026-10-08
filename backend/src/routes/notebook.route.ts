import { Router } from "express";
import { createNotebook, deleteNotebook, getAllNotebookUser, getNotebookById } from "../controllers/notebook.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { validateRequest } from "../middlewares/validateSchema.middelare.js";
import { notebookSchema } from "../schemas/notebook.schema.js";
import { isUserAuthorize } from "../middlewares/authorize.middleware.js";

const notebookRouter = Router()

notebookRouter.post("/",[validateRequest(notebookSchema),authenticate],createNotebook)
notebookRouter.get("/", [authenticate], getAllNotebookUser)
notebookRouter.delete("/:notebookId", [authenticate, isUserAuthorize], deleteNotebook)
notebookRouter.get("/:notebookId",[isUserAuthorize],getNotebookById)

export default notebookRouter