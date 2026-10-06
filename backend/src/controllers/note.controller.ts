import type { Request, Response } from "express";
import response from "../utils/response.js";
import Note from "../models/note.model.js";

export const createNote = async (req:Request, res:Response) => {
    try {
        const { notebookId } = req.params
        const { title, content } = req.body
        const note = await Note.create({ content, title, notebookId })
        response.requestSuccessWithData(res,"berhasil buat note",{note},201)
    } catch (error) {
        response.serverError(res,"gagal create note")
    }
}