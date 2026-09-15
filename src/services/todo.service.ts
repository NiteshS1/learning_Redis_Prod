import { redisKeys } from "../config/redis-key.js";
import { TodoRepository } from "../repositories/todo.repository.js";
import { AppError } from "../types/app-error.js";

import type {
    CreateTodoInput,
    UpdateTodoInput,
} from "../validators/todo.validator.js";
import { CacheService } from "./cache.service.js";

export class TodoService {
    constructor(
        private readonly todoRepository: TodoRepository,
        private readonly cacheService: CacheService,
    ) { }

    async getAllTodos () {
        const cacheKey =
            redisKeys.allTodos();

        const cachedTodos =
            await this.cacheService.get(
                cacheKey
            );

        if (cachedTodos) {
            console.log(
                `[CACHE HIT] ${cacheKey}`,
            );

            return cachedTodos;
        }

        console.log(
            `[CACHE MISS] ${cacheKey}`,
        );

        const todos = await this.todoRepository.findAll();

        await this.cacheService.set(
            cacheKey,
            todos,
            30
        );

        return todos;
    }

    async getTodoById (id: string) {
        const cacheKey =
            redisKeys.todo(id);

        const cachedTodo =
            await this.cacheService.get(
                cacheKey,
            );

        if (cachedTodo) {
            console.log(
                `[CACHE HIT] ${cacheKey}`,
            );

            return cachedTodo;
        }

        console.log(
            `[CACHE MISS] ${cacheKey}`,
        );

        const todo =
            await this.todoRepository.findById(
                id,
            );

        if (!todo) {
            throw new AppError(
                "Todo not found",
                404,
                "TODO_NOT_FOUND",
            );
        }

        await this.cacheService.set(
            cacheKey,
            todo,
            60,
        );

        return todo;
    }

    async createTodo (data: CreateTodoInput) {
        const todo = this.todoRepository.create(data);

        await this.cacheService.delete(
            redisKeys.allTodos(),
        );

        return todo;
    }

    async updateTodo (
        id: string,
        data: UpdateTodoInput,
    ) {
        const existingTodo =
            await this.todoRepository.findById(id);

        if (!existingTodo) {
            throw new AppError(
                "Todo not found",
                404,
                "TODO_NOT_FOUND",
            );
        }

        const updateTodo =
            await this.todoRepository.update(
                id,
                data,
            );

        await Promise.all([
            this.cacheService.delete(
                redisKeys.todo(id),
            ),

            this.cacheService.delete(
                redisKeys.allTodos(),
            ),
        ]);

        return updateTodo;
    }

    async deleteTodo (id: string) {
        const existingTodo =
            await this.todoRepository.findById(id);

        if (!existingTodo) {
            throw new AppError(
                "Todo not found",
                404,
                "TODO_NOT_FOUND",
            );
        }

        await this.todoRepository.delete(id);

        await Promise.all([
            this.cacheService.delete(
                redisKeys.todo(id),
            ),

            this.cacheService.delete(
                redisKeys.allTodos(),
            )
        ]);
    }

    async runSlowQuery () {
        return this.todoRepository.slowQuery(2);
    }

    async getTodoByIdWithoutCache (
        id: string,
    ) {
        const todo = await this.todoRepository.findById(id);

        if (!todo) {
            throw new AppError(
                "Todo not found",
                404,
                "TODO_NOT_FOUND",
            );
        }

        return todo;
    }
}