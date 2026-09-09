import type {
    NextFunction,
    Request,
    Response,
} from "express";

import { ZodError } from "zod";

import { Prisma } from "../generated/prisma/client.js";
import { AppError } from "../types/app-error.js";

export function errorMiddleware (
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
) {
    console.error(error);

    if (error instanceof ZodError) {
        return res.status(400).json({
            success: false,
            error: {
                code: "VALIDATION_ERROR",
                message: "Invalid request",
                details: error.issues,
            },
        });
    }

    if (error instanceof AppError) {
        return res.status(error.statusCode).json({
            success: false,
            error: {
                code: error.code ?? "APPLICATION_ERROR",
                message: error.message,
            },
        });
    }

    if (
        error instanceof
        Prisma.PrismaClientKnownRequestError
    ) {
        return res.status(500).json({
            success: false,
            error: {
                code: "DATABASE_ERROR",
                message: "Database operation failed",
            },
        });
    }

    return res.status(500).json({
        success: false,
        error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Something went wrong",
        },
    });
}