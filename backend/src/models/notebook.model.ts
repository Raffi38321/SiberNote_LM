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


notebookSchema.virtual("jumlah_sumber", {
  ref: "Document",
  localField: "_id",
    foreignField: "notebookId",
  count:true
});

notebookSchema.set("toJSON", { virtuals: true });
notebookSchema.set("toObject", { virtuals: true });


const Notebook = mongoose.model("Notebook", notebookSchema)

export default Notebook
