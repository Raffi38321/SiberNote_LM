import type { Response } from "express";

const response = {
    serverError:(res:Response,message:string)=>{
        return res.status(500).json({
            status:"failed",
            message
        })
    },
    requestSuccess: (res: Response, message: string) => {
        return res.status(200).json({
            status:"success",
            message
        })
    },
    requestSuccessWithData:(res:Response,message:string,data:any,code:number)=>{
        return res.status(code).json({
            status:"success",
            message,
            data
        })
    },
    notFoundError:(res:Response,message:string)=>{
        return res.status(404).json({
            status:"failed",
            message
        })
    },
    userError:(res:Response,message:string)=>{
        return res.status(401).json({
            status:"failed",
            message,
        })
    },
    notAuthorizedError:(res:Response,message:string)=>{
        return res.status(403).json({
            status:"failed",
            message
        })
    },
}

export default response