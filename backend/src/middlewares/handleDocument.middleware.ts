import type { Request, Response, NextFunction } from "express"
import multer from "multer"
import response from "../utils/response.js"
import { uploadDocument, uploadAvatar } from "./upload.middleware.js"

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
                    "Ukuran file melebihi batas maksimal 20 MB",
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

export const handleAvatarUpload = (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    uploadAvatar(req, res, (error) => {
        if (error instanceof multer.MulterError) {
            if (error.code === "LIMIT_FILE_SIZE") {
                return response.userError(res, "Ukuran avatar melebihi batas maksimal 5 MB")
            }
            return response.userError(res, error.message)
        }
        if (error) {
            return response.userError(res, error.message)
        }
        next()
    })
}
