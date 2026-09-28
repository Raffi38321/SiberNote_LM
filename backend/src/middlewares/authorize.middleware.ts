import { type Request, type Response, type NextFunction } from "express";
import response from "../utils/response.js";
import Notebook from "../models/notebook.model.js";

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
