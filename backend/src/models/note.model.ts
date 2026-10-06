import mongoose, { Schema, Types } from "mongoose"

interface INote {
    title: string;
    content: string;
    notebookId: Types.ObjectId;
}

const noteSchema = new mongoose.Schema<INote>({
    title: {
        type: String,
        required: true,
    },
    content: {
        type: String,
        required: true,
    },
    notebookId: {
      type: Schema.Types.ObjectId,
      ref: "Notebook",
      required: true,
    },
}, { timestamps: true })

const Note = mongoose.model("Note", noteSchema)

export default Note