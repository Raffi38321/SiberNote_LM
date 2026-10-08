import type { Request, Response } from "express";
import response from "../utils/response.js";
import Note from "../models/note.model.js";

export const createNote = async (req:Request, res:Response) => {
    try {
        const { notebookId } = req.params
        const { title, content } = req.body
        if (!notebookId || typeof notebookId !== "string") {
            return response.userError(res, "notebookId tidak valid")
        }
        const note = await Note.create({ content, title, notebookId })
        response.requestSuccessWithData(res,"berhasil buat note",{note},201)
    } catch (error) {
        response.serverError(res,"gagal create note")
    }
}

export const getAllNoteByNotebookId = async (req:Request, res:Response) => {
    try {
        const { notebookId } = req.params
        if (!notebookId || typeof notebookId !== "string") {
            return response.userError(res, "notebookId tidak valid")
        }
        const notes = await Note.find({ notebookId })
        response.requestSuccessWithData(res,"berhasil dapet semua note",{notes},200)
    } catch (error) {
        response.serverError(res,"gagal dapet semua note")
    }
}

export const deleteNote = async (req: Request, res: Response) => {
    try {
        const { noteId } = req.params
        if (!noteId || typeof noteId !== "string") {
            return response.userError(res, "noteId tidak valid")
        }
        const note = await Note.findById(noteId)
        if (!note) {
            return response.notFoundError(res,"note tidak ditemukan atau sudah dihapus")
        }
        await Note.findByIdAndDelete(noteId)

        response.requestSuccess(res,"berhasil hapus note")
    } catch (error) {
        response.serverError(res,"gagal hapus note")
    }
}

export const getNoteById = async(req: Request, res: Response)=>{
    try {
        const { noteId } = req.params
        if (!noteId || typeof noteId !== "string") {
            return response.userError(res, "noteId tidak valid")
        }
        const note = await Note.findById(noteId)
        response.requestSuccessWithData(res, "berhasil dapet note", { note }, 200)
    } catch (error) {
        response.serverError(res,"gagal dapet note by id")
    }
}

export const updateNote = async (req: Request, res: Response) => {
    try {
        const { noteId } = req.params
        if (!noteId || typeof noteId !== "string") {
            return response.userError(res, "noteId tidak valid")
        }
        const { title, content } = req.body
        let updateDataNote = {}
        if (title) {
            updateDataNote = { title }
        }
        if (content) {
            updateDataNote = { ...updateDataNote, content }
        }
        
        const note = await Note.findByIdAndUpdate(noteId, { ...updateDataNote }, { returnDocument: "after" })
        if (!note) {
            return response.notFoundError(res,"note tidak ditemukan")
        }
        response.requestSuccessWithData(res, "berhasil update note", { note }, 200)
    } catch (error) {
        response.serverError(res,"gagal update note")
    }
}