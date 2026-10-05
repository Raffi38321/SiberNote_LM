import { type Request, type Response, type NextFunction } from "express";
import response from "../utils/response.js";
import Notebook from "../models/notebook.model.js";
import Document from "../models/document.model.js";

export const isUserAuthorize = async (req: Request,res: Response,next: NextFunction,) => {
  const userId = req.userId;

  if (!userId) {
    return response.userError(res, "tidak terautentikasi");
  }

  const { notebookId } = req.params;

  const notebook = await Notebook.findOne({
    _id: notebookId,
    userId: userId,
  });

  if (!notebook) {
    return response.notFoundError(
      res,
      "notebook tidak ditemukan atau bukan milik user",
    );
  }

  next();
};

/** Cek dokumen milik user lewat notebook pemilik (untuk PATCH/DELETE document). */
export const isDocumentOwner = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const userId = req.userId;

  if (!userId) {
    return response.userError(res, "tidak terautentikasi");
  }

  const { documentId } = req.params;

  if (!documentId) {
    return response.userError(res, "id document kosong");
  }

  const doc = await Document.findById(documentId)
    .select("notebookId")
    .populate<{ notebookId: { userId: { toString(): string } } }>(
      "notebookId",
      "userId",
    );

  if (!doc) {
    return response.notFoundError(res, "dokumen tidak ditemukan");
  }

  if (doc.notebookId.userId.toString() !== userId) {
    return response.notAuthorizedError(res, "tidak punya akses ke dokumen ini");
  }

  next();
};
