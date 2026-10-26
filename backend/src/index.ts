import fs from "fs"
import path from "path"
import express, { type Request, type Response } from "express"
import envVariable from "./utils/ENV.js"
import connectDB from "./services/mongo.js"
import userRouter from "./routes/user.route.js"
import notebookRouter from "./routes/notebook.route.js"
import documentRouter from "./routes/document.route.js"
import cors from "cors"
import noteRouter from "./routes/note.route.js"
import chatRouter from "./routes/chat.route.js"

const app = express()
const PORT = envVariable.PORT

app.use(express.json())
app.use(cors())
await connectDB()

if (!fs.existsSync(envVariable.UPLOADS_DIR)) {
    fs.mkdirSync(envVariable.UPLOADS_DIR, { recursive: true })
}

// Serve file statis dari folder uploads
// Akses: {UPLOAD_BASE_URL}/documents/... atau {UPLOAD_BASE_URL}/avatars/...
app.use("/uploads", express.static(path.resolve(envVariable.UPLOADS_DIR)))

app.get("/", (_req: Request, res: Response) => {
    res.status(200).json({
        status:"success",
        message:"server healthy"
    })
})

app.use("/user", userRouter)
app.use("/notebooks",notebookRouter)
app.use("/documents", documentRouter)
app.use("/notes",noteRouter)
app.use("/chats", chatRouter)

app.listen(PORT, () => {
    console.log("server jalan di port", PORT);
})