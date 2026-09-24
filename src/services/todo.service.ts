import { cacheConfig, NEGATIVE_CACHE_VALUE } from "../config/cache.config.js";
import { redisKeys } from "../config/redis-key.js";
import { TodoRepository } from "../repositories/todo.repository.js";
import { AppError } from "../types/app-error.js";
import { addTtlJitter } from "../utils/cache.ttl.js";

import type {
    CreateTodoInput,
    UpdateTodoInput,
} from "../validators/todo.validator.js";
import { CacheService } from "./cache.service.js";
import { LockService } from "./lock.service.js";

export class TodoService {
    constructor(
        private readonly todoRepository: TodoRepository,
        private readonly cacheService: CacheService,
        private readonly lockSerice: LockService,
    ) { }

    private sleep(ms: number) {
        return new Promise<void>((resolve) => {
            setTimeout(resolve, ms);
        });
    }

    private async waitForCache(
        id: string,
        cacheKey: string,
    ) {
        const maxAttempts = 20;
        const baseDelayMs = 100;

        for (
            let attempt = 1;
            attempt <= maxAttempts;
            attempt++
        ) {

            const jitterMs = Math.random() * 50;

            await this.sleep(baseDelayMs + jitterMs);

            const cached =
                await this.cacheService.getRaw(
                    cacheKey,
                );

            if (
                cached ===
                NEGATIVE_CACHE_VALUE
            ) {
                console.log(
                    `[NEGATIVE CACHE FILLED BY PEER] ${cacheKey}`,
                );

                throw new AppError(
                    "Todo not found",
                    404,
                    "TODO_NOT_FOUND",
                );
            }

            if (cached !== null) {
                console.log(
                    `[CACHE FILLED BY PEER] ${cacheKey}`,
                );

                return JSON.parse(cached);
            }
        }

        console.warn(
            `[CACHE WAIT TIMEOUT] ${cacheKey}`,
        );

        return this.getTodoFromDatabase(id);
    }

    private async getTodoFromDatabase(
        id: string,
    ) {
        console.log(
            `[DATABASE FALLBACK] todo:${id}`,
        );

        const todo = await this.todoRepository.findById(
            id,
        );

        if (!todo) {
            throw new AppError(
                "Todo not found",
                404,
                "TODO_NOT_FOUND",
            );
        }

        return todo;
    }

    async getAllTodos() {
        const cacheKey = redisKeys.allTodos();

        const cachedTodos = await this.cacheService.get(cacheKey);

        if (cachedTodos) {
            console.log(`[CACHE HIT] ${cacheKey}`);

            return cachedTodos;
        }

        console.log(`[CACHE MISS] ${cacheKey}`);

        const todos = await this.todoRepository.findAll();

        const ttl = addTtlJitter(
            cacheConfig.todoList.ttlSeconds,
            cacheConfig.todoList.jitterSeconds,
        );

        await this.cacheService.set(
            cacheKey,
            todos,
            ttl,
        );

        return todos;
    }

    async getTodoById(id: string) {
        const cacheKey =
            redisKeys.todo(id);

        const cached =
            await this.cacheService.getRaw(
                cacheKey,
            );

        if (cached == NEGATIVE_CACHE_VALUE) {
            console.log(
                `[NEGATIVE CACHE HIT] ${cacheKey}`,
            );

            throw new AppError(
                "Todo not found",
                404,
                "TODO_NOT_FOUND",
            );
        }

        if (cached !== null) {
            console.log(
                `[CACHE HIT] ${cacheKey}`,
            );

            return JSON.parse(cached);
        }

        console.log(
            `[CACHE MISS] ${cacheKey}`,
        );

        const cachedTodo =
            await this.cacheService.get(cacheKey,);

        if (cachedTodo) {
            console.log(`[CACHE HIT] ${cacheKey}`,);

            return cachedTodo;
        }

        console.log(`[CACHE MISS] ${cacheKey}`,);

        const lockKey = redisKeys.todoLock(id);

        const lockResult = await this.lockSerice.acquire(
            lockKey,
            5000,
        );

        if (lockResult.status === "unavailable") {
            console.warn(
                `[CACHE COORDINATION UNAVAILABLE] ${cacheKey}`,
            );

            return this.getTodoFromDatabase(id);
        }

        if (lockResult.status === "contended") {
            console.log(
                `[LOCK CONTENDED] ${lockKey}`,
            );

            return this.waitForCache(id, cacheKey);
        }



        if (lockResult.status === "acquired") {
            const lock = lockResult.lock;

            try {
                const cachedAfterLock = await this.cacheService.getRaw(cacheKey);

                if (
                    cachedAfterLock ===
                    NEGATIVE_CACHE_VALUE
                ) {
                    console.log(
                        `[NEGATIVE CACHE HIT AFTER LOCK] ${cacheKey}`,
                    );

                    throw new AppError(
                        "Todo not found",
                        404,
                        "TODO_NOT_FOUND",
                    );
                }

                if (cachedAfterLock !== null) {
                    console.log(
                        `[CACHE HIT AFTER LOCK] ${cacheKey}`,
                    );

                    return JSON.parse(
                        cachedAfterLock,
                    );
                }

                console.log(
                    `[CACHE REBUILD] ${cacheKey}`,
                );

                const todo = await this.todoRepository.findById(id);

                if (!todo) {
                    const negativeTtl =
                        addTtlJitter(
                            cacheConfig.negativeTodo.ttlSeconds,
                            cacheConfig.negativeTodo.jitterSeconds,
                        );

                    await this.cacheService.setRaw(
                        cacheKey,
                        NEGATIVE_CACHE_VALUE,
                        negativeTtl,
                    );

                    console.log(
                        `[NEGATIVE CACHE SET] ${cacheKey} TTL=${negativeTtl}s`,
                    );

                    throw new AppError(
                        "Todo not found",
                        404,
                        "TODO_NOT_FOUND",
                    );
                }

                const ttl = addTtlJitter(
                    cacheConfig.todo.ttlSeconds,
                    cacheConfig.todo.jitterSeconds,
                );

                await this.cacheService.set(
                    cacheKey,
                    todo,
                    ttl,
                );

                console.log(
                    `[CACHE SET] ${cacheKey} TTL=${ttl}s`,
                );

                return todo;
            } finally {
                await this.lockSerice.release(lock);
            }
        }

        // return this.waitForCache(
        //     id,
        //     cacheKey,
        // );
    }

    async createTodo(data: CreateTodoInput) {
        const todo =
            await this.todoRepository.create(data);

        await this.cacheService.delete(
            redisKeys.allTodos(),
        );

        return todo;
    }

    async updateTodo(
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

    async deleteTodo(id: string) {
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

    async runSlowQuery() {
        return this.todoRepository.slowQuery(2);
    }

    async getTodoByIdWithoutCache(
        id: string,
    ) {
        return this.getTodoFromDatabase(id);
    }
}