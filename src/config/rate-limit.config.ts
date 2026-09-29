export const rateLimitConfig = {
    login: {
        limit: 5,
        windowSeconds: 60,
    },

    todoRead: {
        limit: 100,
        windowSeconds: 60,
    },

    todoWrite: {
        limit: 20,
        windowSeconds: 60,
    },
} as const;