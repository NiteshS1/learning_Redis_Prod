import { Router } from "express";

import { TodoController } from "../controllers/todo.controller.js";
import { TodoRepository } from "../repositories/todo.repository.js";
import { CacheService } from "../services/cache.service.js";
import { TodoService } from "../services/todo.service.js";
import { LockService } from "../services/lock.service.js";

const router = Router();

const todoRepository =
    new TodoRepository();

const cacheService =
    new CacheService();

const lockSerice =
    new LockService();

const todoService =
    new TodoService(
        todoRepository,
        cacheService,
        lockSerice,
    );

const todoController =
    new TodoController(todoService);


router.get(
    "/debug/slow",
    todoController.slowQuery,
);

router.get(
    "/",
    todoController.getAllTodos,
);

router.get(
    "/:id",
    todoController.getTodoById,
);

router.post(
    "/",
    todoController.createTodo,
);

router.put(
    "/:id",
    todoController.updateTodo,
);

router.delete(
    "/:id",
    todoController.deleteTodo,
);

router.get(
    "/debug/db/:id",
    todoController.getTodoByIdWithoutCahce,
);

export { router as todoRouter };