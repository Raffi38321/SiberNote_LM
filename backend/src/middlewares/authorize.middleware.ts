import { type Request, type Response, type NextFunction } from "express";
import response from "../utils/response.js";
import Notebook from "../models/notebook.model.js";
import Document from "../models/document.model.js";
import Note from "../models/note.model.js";

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

export const isUserAuthorizeToAccessNote = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { notebookId, noteId } = req.params;

    if (!notebookId || !noteId) {
      return response.userError(res, "notebookId atau noteId kosong");
    }

    const note = await Note.findOne({
      _id: noteId,
      notebookId: notebookId,
    });

    if (!note) {
      return response.notFoundError(res, "Note tidak ditemukan");
    }

    next();
  } catch (error) {
    console.error(error);
    return response.serverError(res, "Gagal memeriksa akses note");
  }
};