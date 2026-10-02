import type { Types } from "mongoose";
import mongoose, { Schema } from "mongoose";

interface IDocument {
  notebookId: Types.ObjectId;
  title: string;
  fileType: "pdf" | "pptx";
  parseStatus: "pending" | "done" | "error";
  fileUrl: string;
  fileSize: number;
  totalPages: number;
}

const documentSchema = new mongoose.Schema<IDocument>(
  {
    notebookId: {
      type: Schema.Types.ObjectId,
      ref: "Notebook",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    fileType: {
      type: String,
      required: true,
      enum: ["pdf", "pptx"],
    },
    fileUrl: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    totalPages: {
      type: Number,
      required: true,
      default: 0
    },
    parseStatus: {
      type: String,
      required: true,
      enum: ["pending", "done", "error"],
      default: "pending",
    },
  },
  { timestamps: true },
);

const Document = mongoose.model("Document", documentSchema);

export default Document;
