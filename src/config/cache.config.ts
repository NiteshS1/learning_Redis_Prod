export const NEGATIVE_CACHE_VALUE = "__NOT_FOUND__";

export const cacheConfig = {
    todo: {
        ttlSeconds: 60,
        jitterSeconds: 30,
    },

    todoList: {
        ttlSeconds: 30,
        jitterSeconds: 15,
    },

    negativeTodo: {
        ttlSeconds: 15,
        jitterSeconds: 5,
    },
} as const;