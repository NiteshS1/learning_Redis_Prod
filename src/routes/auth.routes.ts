import { Router } from "express";
import { SessionService } from "../services/session.service";
import { AuthService } from "../services/auth.service";
import { AuthController } from "../controllers/auth.controller";
import { AuthMiddleware } from "../middleware/auth.middleware";

const router = Router();

const sessionService = new SessionService();

const authService = new AuthService(sessionService);

const authController = new AuthController(authService, sessionService);

const authMiddleware = new AuthMiddleware(sessionService);

router.post("/login", authController.login);

router.get("/me", authMiddleware.requireAuth, authController.me);

router.post("/logout", authMiddleware.requireAuth, authController.logout);

router.post("/logout-all", authMiddleware.requireAuth, authController.logoutAll);

export {
    router as authRouter,
};