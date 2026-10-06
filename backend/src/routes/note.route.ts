import { Router } from "express";
import { createNote } from "../controllers/note.controller.js";

const noteRouter = Router()

noteRouter.post("/:notebookId",createNote)

export default noteRouter