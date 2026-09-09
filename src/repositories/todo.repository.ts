import { prisma } from "../database/prisma.js";

export class TodoRepository {
  async findAll() {
    return prisma.todo.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async findById(id: string) {
    return prisma.todo.findUnique({
      where: {
        id,
      },
    });
  }

  async create(data: {
    title: string;
    description?: string;
  }) {
    return prisma.todo.create({
      data,
    });
  }

  async update(
    id: string,
    data: {
      title?: string;
      description?: string;
      completed?: boolean;
    },
  ) {
    return prisma.todo.update({
      where: {
        id,
      },
      data,
    });
  }

  async delete(id: string) {
    return prisma.todo.delete({
      where: {
        id,
      },
    });
  }
}