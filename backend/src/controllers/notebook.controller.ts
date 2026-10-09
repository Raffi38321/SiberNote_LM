import type { Request, Response } from "express";
import response from "../utils/response.js";
import Notebook from "../models/notebook.model.js";
import Document from "../models/document.model.js";
import Chunk from "../models/chunk.model.js";
import cloudinary from "../services/cloudinary.js";
import Note from "../models/note.model.js";

export const createNotebook = async (req: Request, res: Response) => {
  try {
    const { title, description } = req.body;
    const userId = req.userId;
    if (!userId) {
      return response.userError(res, "tidak terautentikasi");
    }

    const notebook = await Notebook.create({ description, title, userId });
    return response.requestSuccessWithData(
      res,
      "berhasil buat notebook",
      { notebook },
      201,
    );
  } catch (error) {
    console.log(error);
    return response.serverError(res, "gagal buat notebook");
  }
};

export const getAllNotebookUser = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return response.userError(res, "tidak terautentikasi");
    }

    const notebooks = await Notebook.find({ userId })
      .sort({
        isPinned: -1,
        updatedAt: -1,
      })
      .populate({
        path: "jumlah_sumber",
        select: "-fileUrl",
      })
      .lean({ virtuals: true });

    return response.requestSuccessWithData(
      res,
      "berhasil mendapatkan semua notebook user",
      { notebooks },
      200,
    );
  } catch (error) {
    console.error(error);
    return response.serverError(
      res,
      "gagal mendapatkan semua notebook user",
    );
  }
};

export const deleteNotebook = async (req: Request, res: Response) => {
    try {
        const { notebookId } = req.params

        const notebook = await Notebook.findById(notebookId)

        if (!notebook) {
            return response.notFoundError(res, "notebook tidak ditemukan")
        }

        const documents = await Document.find({ notebookId: notebook._id })

        for (const document of documents) {
            const urlParts = document.fileUrl.split("/")
            const uploadIndex = urlParts.indexOf("upload")

            if (uploadIndex !== -1) {
                const publicIdWithExt = urlParts
                    .slice(uploadIndex + 2)
                    .join("/")

                const publicId = publicIdWithExt.replace(
                    /\.[^.]+$/,
                    ""
                )

                await cloudinary.uploader.destroy(publicId, {
                    resource_type: "raw",
                })
            }
        }

        const documentIds = documents.map(
            (document) => document._id
        )

        if (documentIds.length > 0) {
            await Chunk.deleteMany({
                documentId: { $in: documentIds },
            })

            await Document.deleteMany({
                _id: { $in: documentIds },
            })
        }

        await Note.deleteMany({ notebookId:notebook._id})
        await notebook.deleteOne()

        return response.requestSuccess(
            res,
            "berhasil hapus notebook"
        )
    } catch (error) {
        console.error(error)

        return response.serverError(
            res,
            "gagal hapus notebook"
        )
    }
}

export const getNotebookById = async (req: Request, res: Response) => {
    try {
        const { notebookId } = req.params
        if (!notebookId || typeof notebookId !== "string") {
            return response.userError(res, "notebookId tidak valid")
        }
        const notebook = await Notebook.findById(notebookId)
        if (!notebook) {
            return response.notFoundError(
                res,
                "notebook tidak ditemukan"
            )
        }
        const notes = await Note.find({notebookId})
        const documents = await Document.find({ notebookId })
        response.requestSuccessWithData(res,"berhasil dapet notebook",{notebook,notes,documents},200)
    } catch (error) {
        return response.serverError(
            res,
            "gagal dapet notebook by id"
        )
    }
}

export const pinNotebook = async(req: Request, res: Response) => {
    try {
        const { notebookId } = req.params
        if (!notebookId || typeof notebookId !== "string") {
            return response.userError(res, "notebookId tidak valid")
        }
        const {pinned} = req.body
        const notebook = await Notebook.findByIdAndUpdate(notebookId, { isPinned: pinned }, { returnDocument: "after" })
        if (!notebook) {
            return response.notFoundError(
                res,
                "notebook tidak ditemukan"
            )
        }
        response.requestSuccessWithData(res,"berhasil pin notebook",{notebook},200)
    } catch (error) {
        return response.serverError(
            res,
            "gagal pin notebook"
        )
    }
}

export const updateNotebook = async(req: Request, res: Response)=>{
    try {
        const { notebookId } = req.params
        if (!notebookId || typeof notebookId !== "string") {
            return response.userError(res, "notebookId tidak valid")
        }
        const { title, description } = req.body
        let updateDataNotebook = {}
        if (title) {
            updateDataNotebook = { title }
        }
        if (description) {
            updateDataNotebook = { ...updateDataNotebook, description }
        }
        
        const notebook = await Notebook.findByIdAndUpdate(notebookId, { ...updateDataNotebook }, { returnDocument: "after" })
        if (!notebook) {
            return response.notFoundError(res,"notebook tidak ditemukan")
        }
        response.requestSuccessWithData(res,"berhasil update notebook",{notebook},200)
    } catch (error) {
        return response.serverError(
            res,
            "gagal update notebook"
        )
    }
}