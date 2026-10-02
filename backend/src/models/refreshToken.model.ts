import mongoose from "mongoose"

interface IRefreshToken {
    userId: mongoose.Types.ObjectId
    token: string
    expiresAt: Date
}

const refreshTokenSchema = new mongoose.Schema<IRefreshToken>({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    token: {
        type: String,
        required: true,
        unique: true,
    },
    expiresAt: {
        type: Date,
        required: true,
    },
}, { timestamps: true })

// auto hapus kalo waktunya lwat
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema)

export default RefreshToken
