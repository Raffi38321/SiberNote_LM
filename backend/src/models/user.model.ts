import mongoose from "mongoose"

interface IUser {
    email: string
    username: string
    password: string
    avatarUrl: string
}

const userSchema = new mongoose.Schema<IUser>({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
    },
    avatarUrl: {
        type: String,
        default: "",
    },
}, { timestamps: true })

const User = mongoose.model("User", userSchema)

export default User
