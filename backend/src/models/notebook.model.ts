import mongoose, { Schema, Types } from "mongoose"

interface INotebook {
    userId: Types.ObjectId
    title: string
    description: string
    isPinned: boolean
}

const notebookSchema = new mongoose.Schema<INotebook>({
    userId: { type: Schema.Types.ObjectId, ref: "User", requires: true },
    title: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        required: true,
        trim: true,
    },
    isPinned: {
        type: Boolean,
        default: false
    }
}, { timestamps: true })

const Notebook = mongoose.model("Notebook", notebookSchema)

export default Notebook
