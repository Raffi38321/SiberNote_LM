import { type Request, type Response, type NextFunction } from "express";
import response from "../utils/response.js";
import Notebook from "../models/notebook.model.js";
import Document from "../models/document.model.js";
import Note from "../models/note.model.js";
import Message from "../models/message.model.js";

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

export const isUserCanAccessCitation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.userId

    if (!userId) {
      return response.userError(res, "tidak terautentikasi")
    }

    const { messageId } = req.params

    if (!messageId) {
      return response.userError(res, "messageId kosong")
    }

    // message → notebookId → verify notebook milik user
    const message = await Message.findById(messageId)
      .select("notebookId role")
      .populate<{ notebookId: { userId: { toString(): string } } }>(
        "notebookId",
        "userId"
      )

    if (!message) {
      return response.notFoundError(res, "message tidak ditemukan")
    }

    if (message.notebookId.userId.toString() !== userId) {
      return response.notAuthorizedError(res, "tidak punya akses ke citation ini")
    }

    if (message.role !== "assistant") {
      return response.userError(res, "citation hanya ada pada pesan assistant")
    }

    next()
  } catch (error) {
    console.error(error)
    return response.serverError(res, "Gagal memeriksa akses citation")
  }
}