import mongoose, { Schema, Types } from "mongoose"

interface INotebook {
    userId: Types.ObjectId
    title: string
    description: string
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
}, { timestamps: true })

const Notebook = mongoose.model("Notebook", notebookSchema)

export default Notebook
