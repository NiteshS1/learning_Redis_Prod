import { redis } from "../database/redis.js";

export class CacheService {
    async get<T> (
        key: string,
    ): Promise<T | null> {
        const start =
            performance.now();

        try {
            if (!redis.isReady) {
                console.warn(
                    `[CACHE BYPASS] Redis not ready: ${key}`,
                );

                return null;
            }

            const value =
                await redis.get(key);

            const duration =
                performance.now() - start;

            if (value === null) {
                console.log(
                    `[REDIS MISS] ${key} ${duration.toFixed(2)}ms`,
                );

                return null;
            }

            console.log(
                `[REDIS HIT] ${key} ${duration.toFixed(2)}ms`,
            );

            return JSON.parse(value) as T;
        } catch (error) {
            const duration =
                performance.now() - start;

            console.error(
                `[REDIS ERROR] ${key} ${duration.toFixed(2)}ms`,
                error,
            );

            return null;
        }
    }

    async set<T> (
        key: string,
        value: T,
        ttlSeconds?: number,
    ): Promise<void> {
        try {
            if (!redis.isReady) {
                return;
            }

            const serialized =
                JSON.stringify(value);

            if (ttlSeconds) {
                await redis.set(
                    key,
                    serialized,
                    {
                        expiration: {
                            type: "EX",
                            value: ttlSeconds,
                        },
                    },
                );

                return;
            }

            await redis.set(
                key,
                serialized,
            );
        } catch (error) {
            console.error(
                `[CACHE SET ERROR] ${key}`,
                error,
            );
        }
    }

    async delete (
        key: string,
    ): Promise<void> {
        try {
            if (!redis.isReady) {
                return;
            }

            await redis.del(key);
        } catch (error) {
            console.error(
                `[CACHE DELETE ERROR] ${key}`,
                error,
            );
        }
    }
}