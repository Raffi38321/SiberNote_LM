import mongoose from "mongoose"
import envVariable from "../utils/ENV.js"
import { ensureVectorSearchIndex } from "../models/chunk.model.js"

const connectDB = async () => {
    try {
        await mongoose.connect(envVariable.MONGO_URL)
        console.log("berhasil konek mongo")
        await ensureVectorSearchIndex()
    } catch (error) {
        console.log(error)
        process.exit(1)
    }
}

export default connectDB
