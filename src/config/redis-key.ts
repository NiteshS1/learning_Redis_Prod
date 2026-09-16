export const redisKeys = {
    todo: (id: string) =>
        `todo:${id}`,

    allTodos: () => 
        "todos:all"
}