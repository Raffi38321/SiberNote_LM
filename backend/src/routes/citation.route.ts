import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { isUserCanAccessCitation } from "../middlewares/authorize.middleware.js";
import { getCitation } from "../controllers/citation.controller.js";

const citationRouter = Router()

citationRouter.get("/:messageId/:citationIndex", [authenticate, isUserCanAccessCitation], getCitation)

export default citationRouter
