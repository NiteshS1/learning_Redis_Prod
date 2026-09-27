import { Router } from "express";

import { TodoController } from "../controllers/todo.controller.js";
import { TodoRepository } from "../repositories/todo.repository.js";
import { CacheService } from "../services/cache.service.js";
import { TodoService } from "../services/todo.service.js";
import { LockService } from "../services/lock.service.js";
import { SessionService } from "../services/session.service.js";
import { AuthMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

const todoRepository = new TodoRepository();

const cacheService = new CacheService();

const lockSerice = new LockService();

const sessionService = new SessionService();

const todoService = new TodoService(todoRepository, cacheService, lockSerice);

const todoController = new TodoController(todoService);

const authMiddleware = new AuthMiddleware(sessionService);

router.use(authMiddleware.requireAuth);

router.get("/debug/slow", todoController.slowQuery,);

router.get("/", todoController.getAllTodos);

router.get("/:id", todoController.getTodoById);

router.post("/", todoController.createTodo);

router.put("/:id", todoController.updateTodo);

router.delete("/:id", todoController.deleteTodo);

router.get("/debug/db/:id", todoController.getTodoByIdWithoutCahce);

export { router as todoRouter };