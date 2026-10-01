import { Router } from "express";
import { SessionService } from "../services/session.service";
import { AuthService } from "../services/auth.service";
import { AuthController } from "../controllers/auth.controller";
import { AuthMiddleware } from "../middleware/auth.middleware";
import { RateLimitService } from "../services/rate-limit.service";
import { RateLimitMiddleware } from "../middleware/rate-limit.middleware";
import { rateLimitConfig } from "../config/rate-limit.config";
import { hashIdentifier } from "../utils/hash-identifier";

const router = Router();

const sessionService = new SessionService();

const authService = new AuthService(sessionService);

const authController = new AuthController(authService, sessionService);

const authMiddleware = new AuthMiddleware(sessionService);

const ratelimitService = new RateLimitService();

const rateLimitMiddleware = new RateLimitMiddleware(ratelimitService);

const loginRateLimit = rateLimitMiddleware.create({
    scope: "login",
    algorithm: "sliding",
    failureMode: "closed",
    limit: rateLimitConfig.login.limit,
    windowSeconds: rateLimitConfig.login.windowSeconds,
    getIdentifier: (req) => hashIdentifier(req.ip ?? ""),
})

router.post("/login", loginRateLimit, authController.login);

router.get("/me", authMiddleware.requireAuth, authController.me);

router.post("/logout", authMiddleware.requireAuth, authController.logout);

router.post("/logout-all", authMiddleware.requireAuth, authController.logoutAll);

export {
    router as authRouter,
};