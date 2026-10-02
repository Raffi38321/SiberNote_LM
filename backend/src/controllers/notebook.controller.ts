import type { Request, Response } from "express";
import response from "../utils/response.js";
import Notebook from "../models/notebook.model.js";
import User from "../models/user.model.js";

export const createNotebook = async (req: Request, res: Response) => {
  try {
    const { title, description } = req.body;
    const userId = req.userId;
    if (!userId) {
      return response.userError(res, "tidak terautentikasi");
    }

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return response.notFoundError(res, "user tidak ketemu");
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

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return response.notFoundError(res, "user tidak ketemu");
    }
    const notebooks = await Notebook.find({ userId }).sort({ updatedAt: -1 });
    return response.requestSuccessWithData(
      res,
      "berhasil dapet smua notebook use",
      { notebooks },
      200,
    );
  } catch (error) {
    console.log(error);
    return response.serverError(res, "gagal dapetin semua notebook user");
  }
};

export const deleteNotebook = async (req: Request, res: Response) => {
    try {
        const {notebookId} = req.params
        await Notebook.findByIdAndDelete(notebookId)
        return response.requestSuccess(res,"berhasil hapus notebook")
  } catch (error) {
    console.log(error);
    return response.serverError(res, "gagal hapus notebook");
  }
};
