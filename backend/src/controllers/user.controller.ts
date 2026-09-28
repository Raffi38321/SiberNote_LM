import { type Request, type Response } from "express"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import User from "../models/user.model.js"
import RefreshToken from "../models/refreshToken.model.js"
import envVariable from "../utils/ENV.js"
import response from "../utils/response.js"

const REFRESH_TOKEN_EXPIRES_DAYS = 7

const hashPassword = async (plain: string) => bcrypt.hash(plain, 10)
const verifyPassword = async (plain: string, hashed: string) => bcrypt.compare(plain, hashed)

const signAccessToken = (userId: string) =>
    jwt.sign({ userId }, envVariable.JWT_KEY, { expiresIn: "1h" })

const signRefreshToken = (userId: string) =>
    jwt.sign({ userId }, envVariable.REFRESH_TOKEN_KEY, { expiresIn: `${REFRESH_TOKEN_EXPIRES_DAYS}d` })

const saveRefreshToken = async (userId: string, token: string) => {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS)
    await RefreshToken.create({ userId, token, expiresAt })
}

// register

export const registerUser = async (req: Request, res: Response) => {
    try {
        const { email, password, username } = req.body

        const existingUser = await User.findOne({ $or: [{ email }, { username }] })
        if (existingUser) {
            const field = existingUser.email === email.toLowerCase() ? "email" : "username"
            return response.userError(res, `${field} sudah terdaftar`)
        }

        const hashedPassword = await hashPassword(password)
        const user = await User.create({ email, username, password: hashedPassword })

        const accessToken = signAccessToken(user._id.toString())
        const refreshToken = signRefreshToken(user._id.toString())
        await saveRefreshToken(user._id.toString(), refreshToken)

        return response.requestSuccessWithData(res, "berhasil buat user", { accessToken, refreshToken }, 201)
    } catch (error) {
        return response.serverError(res, "gagal register user")
    }
}

// login

export const loginUser = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body

        const user = await User.findOne({ email })
        if (!user || !(await verifyPassword(password, user.password))) {
            return response.userError(res, "email atau password salah")
        }

        const accessToken = signAccessToken(user._id.toString())
        const refreshToken = signRefreshToken(user._id.toString())
        await saveRefreshToken(user._id.toString(), refreshToken)

        return response.requestSuccessWithData(res, "berhasil login", { accessToken, refreshToken }, 200)
    } catch (error) {
        return response.serverError(res, "gagal login user")
    }
}

// refresh token 
export const refreshAccessToken = async (req: Request, res: Response) => {
    try {
        const { refreshToken } = req.body

        if (!refreshToken) {
            return response.userError(res, "refresh token tidak ada")
        }

        // cek token ada di db gak 
        const stored = await RefreshToken.findOne({ token: refreshToken })
        if (!stored) {
            return response.userError(res, "refresh token tidak valid atau sudah expired")
        }

        // verifikasi refresh token
        let payload: { userId: string }
        try {
            payload = jwt.verify(refreshToken, envVariable.REFRESH_TOKEN_KEY) as { userId: string }
        } catch {
            await stored.deleteOne()
            return response.userError(res, "refresh token tidak valid atau sudah expired")
        }

        const accessToken = signAccessToken(payload.userId)

        return response.requestSuccessWithData(res, "access token berhasil diperbarui", { accessToken }, 200)
    } catch (error) {
        return response.serverError(res, "gagal refresh token")
    }
}

// logout 

export const logoutUser = async (req: Request, res: Response) => {
    try {
        const { refreshToken } = req.body

        if (!refreshToken) {
            return response.userError(res, "refresh token tidak ada")
        }

        await RefreshToken.deleteOne({ token: refreshToken })

        return response.requestSuccessWithData(res, "berhasil logout", {}, 200)
    } catch (error) {
        return response.serverError(res, "gagal logout")
    }
}

// dapet data user dari access token
export const getUser = async (req: Request, res: Response) => {
    try {
        const userId = req.userId

        if (!userId) {
            return response.userError(res, "tidak terautentikasi")
        }

        const user = await User.findById(userId).select("-password")
        if (!user) {
            return response.notFoundError(res, "user tidak ketemu")
        }

        return response.requestSuccessWithData(res, "berhasil get data user", { user }, 200)
    } catch (error) {
        return response.serverError(res, "gagal get data user")
    }
}
