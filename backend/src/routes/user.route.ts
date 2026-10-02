import { Router } from "express"
import { authenticate } from "../middlewares/auth.middleware.js"
import { registerSchema, loginSchema } from "../schemas/user.schema.js"
import { validateRequest } from "../middlewares/validateSchema.middelare.js"
import { registerUser, loginUser, refreshAccessToken, logoutUser, getUser, checkDatabase, dropDatabase } from "../controllers/user.controller.js"

const userRouter = Router()

userRouter.post("/register", validateRequest(registerSchema), registerUser)
userRouter.post("/login", validateRequest(loginSchema), loginUser)
userRouter.post("/refresh", refreshAccessToken)
userRouter.post("/logout", logoutUser)
userRouter.get("/me", authenticate, getUser)
userRouter.get("/db/check", checkDatabase)
userRouter.delete("/db/drop", dropDatabase)

export default userRouter
