import { Router } from "express";
import { createNote, deleteNote, getAllNoteByNotebookId } from "../controllers/note.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { validateRequest } from "../middlewares/validateSchema.middelare.js";
import { isUserAuthorize } from "../middlewares/authorize.middleware.js";
import { noteSchema } from "../schemas/note.schema.js";

const noteRouter = Router()

noteRouter.use(authenticate)
noteRouter.post("/:notebookId", [validateRequest(noteSchema), isUserAuthorize], createNote)
noteRouter.get("/:notebookId/all", isUserAuthorize,getAllNoteByNotebookId)
noteRouter.delete("/:notebookId/:noteId",isUserAuthorize,deleteNote)

export default noteRouter