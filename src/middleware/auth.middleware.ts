import { NextFunction, Request, Response } from "express";
import { SessionService } from "../services/session.service";
import { sessionConfig } from "../config/session.config";
import { AppError } from "../types/app-error";

export class AuthMiddleware {
    constructor(
        private readonly sessionService: SessionService,
    ) { }

    requireAuth = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const sessionId = req.cookies?.[
                sessionConfig.cookieName
            ];

            if (typeof sessionId !== "string" || !sessionId) {
                throw new AppError(
                    "Authentication required",
                    401,
                    "AUTHENTICATION_REQUIRED",
                );
            }

            let session;

            try {
                session = await this.sessionService.getSession(sessionId);
            } catch (error) {
                if (
                    error instanceof Error &&
                    error.message === "SESSION_STORE_UNAVAILABLE"
                ) {
                    throw new AppError(
                        "Authentication service temporarily unavailable",
                        503,
                        "SESSION_STORE_UNAVAILABLE",
                    );
                }
                throw error;
            }

            if (!session) {
                throw new AppError(
                    "Session expired or invalid",
                    401,
                    "INVALID_SESSION",
                );
            }

            const ttl = await this.sessionService.touchSession(sessionId, session);

            if (ttl <= 0) {
                throw new AppError(
                    "Session expired",
                    401,
                    "SESSION_EXPIRED",
                );
            }

            res.cookie(
                sessionConfig.cookieName,
                sessionId,
                {
                    ...sessionConfig.cookie,
                    maxAge: ttl * 1000,
                },
            );

            req.auth = {
                sessionId,
                session: {
                    ...session,
                    lastAccessedAt: Date.now(),
                },
            };

            next();
        } catch (error) {
            next(error);
        }
    };
}