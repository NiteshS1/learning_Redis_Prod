import { prisma } from "../database/prisma.js";
import type {
  CreateTodoInput,
  UpdateTodoInput,
} from "../validators/todo.validator.js";

export class TodoRepository {
  async findAll () {
    const start = performance.now();

    try {
      return await prisma.todo.findMany({
        orderBy: {
          createdAt: "desc",
        },
      });
    } finally {
      const duration =
        performance.now() - start;

      console.log(
        `[DB] TodoRepository.findAll ${duration.toFixed(2)}ms`,
      );
    }
  }

  async findById (id: string) {
    return prisma.todo.findUnique({
      where: {
        id,
      },
    });
  }

  async create (data: CreateTodoInput) {
    return prisma.todo.create({
      data,
    });
  }

  async update (id: string, data: UpdateTodoInput) {
    return prisma.todo.update({
      where: {
        id,
      },

      data,
    });
  }

  async delete (id: string) {
    return prisma.todo.delete({
      where: {
        id,
      },
    });
  }

  async slowQuery (seconds: number) {
    const start = performance.now();

    try {
      await prisma.$queryRaw`
        SELECT 'slept'::text AS result
        FROM pg_sleep(${seconds});
      `;

      return {
        message: `Database slept for ${seconds} seconds`,
      };
    } finally {
      const duration =
        performance.now() - start;

      console.log(
        `[DB-SLOW] ${duration.toFixed(2)}ms`,
      );
    }
  }
}