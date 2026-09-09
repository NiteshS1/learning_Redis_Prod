import { Router } from "express";

import { TodoController } from "../controllers/todo.controller.js";
import { TodoRepository } from "../repositories/todo.repository.js";
import { TodoService } from "../services/todo.service.js";

const router = Router();

const todoRepository = new TodoRepository();

const todoService =
    new TodoService(todoRepository);

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

export { router as todoRouter };