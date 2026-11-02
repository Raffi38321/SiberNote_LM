import { type Request, type Response, type NextFunction } from "express"
import jwt, { type JwtPayload } from "jsonwebtoken"
import envVariable from "../utils/ENV.js"
import response from "../utils/response.js"

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        response.userError(res, "Sesi Anda telah berakhir, silakan login kembali",401)
        return
    }

    const token = authHeader.split(" ")[1]

    if (!token) {
        response.userError(res, "Sesi Anda telah berakhir, silakan login kembali",401)
        return
    }

    try {
        const decoded = jwt.verify(token, envVariable.JWT_KEY) as JwtPayload

        if (typeof decoded.userId !== "string") {
            response.userError(res, "Sesi Anda telah berakhir, silahkan login kembali",401)
            return
        }

        req.userId = decoded.userId
        next()
    } catch (error) {
        response.userError(res, "Sesi Anda telah berakhir, silahkan login kembali",401)
        return
    }
}
