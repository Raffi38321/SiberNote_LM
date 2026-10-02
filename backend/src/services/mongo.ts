import mongoose from "mongoose";
import envVariable from "../utils/ENV.js";

const connectDB = async () => {
    try {
        await mongoose.connect(envVariable.MONGO_URL)
        console.log("berhasil konek mongo")
    } catch (error) {
        console.log(error);
        process.exit(1)
    }
}

export default connectDB