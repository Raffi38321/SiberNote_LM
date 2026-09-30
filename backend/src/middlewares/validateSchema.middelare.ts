import type { Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";
import response from "../utils/response.js";

type ValidationSchema = {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
};

export const validateRequest = (schema: ValidationSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }

      if (schema.query) {
        req.query = (await schema.query.parseAsync(
          req.query,
        )) as typeof req.query;
      }

      if (schema.params) {
        req.params = (await schema.params.parseAsync(
          req.params,
        )) as typeof req.params;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const message = error.issues.map((issue) => issue.message).join(", ");

        return response.userError(res, message);
      }
      return response.serverError(res, "error di middleware validasi schema");
    }
  };
};
