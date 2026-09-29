import { Router } from "express";

import { TodoController } from "../controllers/todo.controller.js";
import { TodoRepository } from "../repositories/todo.repository.js";
import { CacheService } from "../services/cache.service.js";
import { TodoService } from "../services/todo.service.js";
import { LockService } from "../services/lock.service.js";
import { SessionService } from "../services/session.service.js";
import { AuthMiddleware } from "../middleware/auth.middleware.js";
import { RateLimitMiddleware } from "../middleware/rate-limit.middleware.js";
import { RateLimitService } from "../services/rate-limit.service.js";
import { rateLimitConfig } from "../config/rate-limit.config.js";

const router = Router();

const todoRepository = new TodoRepository();

const cacheService = new CacheService();

const lockSerice = new LockService();

const sessionService = new SessionService();

const todoService = new TodoService(todoRepository, cacheService, lockSerice);

const todoController = new TodoController(todoService);

const authMiddleware = new AuthMiddleware(sessionService);

const rateLimitService = new RateLimitService();

const rateLimitMiddleware = new RateLimitMiddleware(rateLimitService);

const todoReadRateLimit = rateLimitMiddleware.create({
    scope: "todo-read",
    limit: rateLimitConfig.todoRead.limit,
    windowSeconds: rateLimitConfig.todoRead.windowSeconds,
    getIdentifier: (req) => req.auth!.session.id,
});

const todoWriteRateLimit = rateLimitMiddleware.create({
    scope: "todo-write",
    limit: rateLimitConfig.todoWrite.limit,
    windowSeconds: rateLimitConfig.todoWrite.windowSeconds,
    getIdentifier: (req) => req.auth!.session.id,
});

router.use(authMiddleware.requireAuth);

router.get("/debug/slow", todoController.slowQuery,);

router.get("/", todoReadRateLimit, todoController.getAllTodos);

router.get("/:id", todoReadRateLimit, todoController.getTodoById);

router.post("/", todoWriteRateLimit, todoController.createTodo);

router.put("/:id", todoWriteRateLimit, todoController.updateTodo);

router.delete("/:id", todoWriteRateLimit, todoController.deleteTodo);

router.get("/debug/db/:id", todoController.getTodoByIdWithoutCahce);

export { router as todoRouter };