import { NextFunction, Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { SessionService } from "../services/session.service";
import { loginSchema } from "../validators/auth.validator";
import { sessionConfig } from "../config/session.config";

export class AuthController {
    constructor(
        private readonly authService: AuthService,

        private readonly sessionService: SessionService,
    ) { }

    login = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const input = loginSchema.parse(req.body);

            const result = await this.authService.login(input);

            res.cookie(sessionConfig.cookieName, result.sessionId, {
                ...sessionConfig.cookie,
                maxAge: result.ttlSeconds * 1000,
            });

            res.status(200).json({
                success: true,

                data: {
                    userId: result.session.userId,
                    session: {
                        createdAt: result.session.createdAt,
                        absoluteExpiresAt: result.session.absoluteExpiresAt,
                    },
                },
            });
        } catch (error) {
            next(error);
        }
    };

    me = async (req: Request, res: Response) => {
        res.status(200).json({
            success: true,

            data: {
                userId: req.auth!.session.userId,
                createdAt: req.auth!.session.createdAt,
                lastAccessedAt: req.auth!.session.lastAccessedAt,
                absoluteExpiresAt: req.auth!.session.absoluteExpiresAt,
            },
        });
    };

    logout = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const sessionId = req.auth!.sessionId;
            const userId = req.auth!.session.userId;

            await this.sessionService.deleteSession(sessionId, userId);

            res.clearCookie(
                sessionConfig.cookieName,
                sessionConfig.cookie,
            );

            res.status(200).json({
                success: true,
                message: "Logged out successfully",
            });
        } catch (error) {
            next(error);
        }
    };

    logoutAll = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.auth!.session.userId;

            const count = await this.sessionService.deleteAllUserSessions(userId);

            res.clearCookie(
                sessionConfig.cookieName,
                sessionConfig.cookie,
            );

            res.status(200).json({
                success: true,

                data: {
                    revokedSessions: count,
                },

                message: "Logged out from all devices",
            });
        } catch (error) {
            next(error);
        }
    };
}