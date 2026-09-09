import { TodoRepository } from "../repositories/todo.repository.js";
import { AppError } from "../types/app-error.js";

import type {
    CreateTodoInput,
    UpdateTodoInput,
} from "../validators/todo.validator.js";

export class TodoService {
    constructor(
        private readonly todoRepository: TodoRepository,
    ) { }

    async getAllTodos () {
        return this.todoRepository.findAll();
    }

    async getTodoById (id: string) {
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

    async createTodo (data: CreateTodoInput) {
        return this.todoRepository.create(data);
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

        return this.todoRepository.update(id, data);
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
    }

    async runSlowQuery() {
        return this.todoRepository.slowQuery(2);
    }
}