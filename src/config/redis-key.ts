export const redisKeys = {
    todo: (id: string) =>
        `todo:${id}`,

    allTodos: () =>
        "todos:all",

    todoLock: (id: string) =>
        `lock:todo:${id}`,
};