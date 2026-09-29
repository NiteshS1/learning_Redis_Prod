import { createHash } from "node:crypto";

export function hashSessionId(sessionId: string) {
    return createHash("sha256")
        .update(sessionId)
        .digest("hex");
}

export const redisKeys = {
    todo: (id: string) =>
        `todo:${id}`,

    allTodos: () =>
        "todos:all",

    todoLock: (id: string) =>
        `lock:todo:${id}`,

    sessionByHash: (sessionHash: string) =>
        `session:${sessionHash}`,

    session: (sessionId: string) =>
        `session:${hashSessionId(sessionId)}`,

    userSessions: (userId: string) =>
        `user:${userId}:sessions`,

    rateLimitIp: (
        scope: string,
        ip: string,
        windowId: number,
    ) => `rate-limit:ip:${scope}:${ip}:${windowId}`,

    rateLimitUser: (
        scope: string,
        userId: string,
        windowId: number,
    ) => `rate-limit:user:${scope}:${userId}:${windowId}`,
};