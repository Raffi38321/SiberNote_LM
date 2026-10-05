import type { Request, Response, NextFunction } from "express"
import multer from "multer"
import response from "../utils/response.js"
import { uploadDocument } from "./upload.middleware.js"

export const handleDocumentUpload = (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    uploadDocument(req, res, (error) => {

        if (error instanceof multer.MulterError) {

            if (error.code === "LIMIT_FILE_SIZE") {
                return response.userError(
                    res,
                    "ukuran file maksimal 10 MB",
                )
            }
            return response.userError(res, error.message)
        }
        if (error) {
            return response.userError(res, error.message)
        }
        next()
    })
}