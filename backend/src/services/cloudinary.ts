import { v2 as cloudinary } from "cloudinary"
import envVariable from "../utils/ENV.js"

cloudinary.config({
    cloud_name: envVariable.CLOUDINARY_CLOUD_NAME,
    api_key: envVariable.CLOUDINARY_API_KEY,
    api_secret: envVariable.CLOUDINARY_API_SECRET,
})

export default cloudinary
