import { Router } from "express";
import { createNote, deleteNote, getAllNoteByNotebookId, getNoteById, updateNote } from "../controllers/note.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { validateRequest } from "../middlewares/validateSchema.middelare.js";
import { isUserAuthorize, isUserAuthorizeToAccessNote } from "../middlewares/authorize.middleware.js";
import { noteSchema, updateNoteSchema } from "../schemas/note.schema.js";

const noteRouter = Router()

noteRouter.use(authenticate)
noteRouter.post("/:notebookId", [validateRequest(noteSchema), isUserAuthorize], createNote)
noteRouter.get("/:notebookId/all", isUserAuthorize,getAllNoteByNotebookId)
noteRouter.delete("/:notebookId/:noteId", [isUserAuthorize,isUserAuthorizeToAccessNote], deleteNote)
noteRouter.get("/:notebookId/:noteId",[isUserAuthorize,isUserAuthorizeToAccessNote],getNoteById)
noteRouter.put("/:notebookId/:noteId",[validateRequest(updateNoteSchema),isUserAuthorize,isUserAuthorizeToAccessNote],updateNote)

export default noteRouter