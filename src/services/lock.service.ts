import { randomUUID } from "node:crypto";
import { redis } from "../database/redis";

export interface Lock {
    key: string;
    token: string;
}

export class LockService {
    async acquire (
        key: string,
        ttlMs: 5000,
    ): Promise<Lock | null> {
        if (!redis.isReady) {
            return null;
        }

        const token = randomUUID();

        const result = await redis.set(
            key,
            token,
            {
                condition: "NX",
                expiration: {
                    type: "PX",
                    value: ttlMs,
                },
            },
        );

        if (result !== "OK") {
            return null;
        }

        return {
            key,
            token,
        };
    }

    async release (
        lock: Lock,
    ): Promise<boolean> {
        if (!redis.isReady) {
            return false;
        }

        const result = await redis.eval(
            `
                if redis.call("GET", KEYS[1]) == ARGV[1] then
                    return redis.call("DEL", KEYS[1])
                else
                    return 0
                end
            `,
            {
                keys: [lock.key],
                arguments: [lock.token],
            },
        );

        return result === 1;
    }
}