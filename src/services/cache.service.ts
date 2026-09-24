import { redis } from "../database/redis.js";

export class CacheService {
    private logCacheError (
        operation: string,
        key: string,
        error: unknown,
    ) {
        const message =
            error instanceof Error
                ? error.message
                : String(error);

        if (
            message
                .toLowerCase()
                .includes("maxmemory")
        ) {
            console.error(
                `[CACHE MEMORY PRESSURE] ${operation} ${key}`,
            );

            return;
        }

        console.error(
            `[CACHE ${operation} ERROR] ${key}`,
            error,
        );
    }

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

            this.logCacheError(
                "GET",
                key,
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
            this.logCacheError(
                "SET",
                key,
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
            this.logCacheError(
                "DELETE",
                key,
                error,
            );
        }
    }

    async getRaw (
        key: string,
    ): Promise<string | null> {
        try {
            if (!redis.isReady) {
                return null;
            }

            return await redis.get(key);
        } catch (error) {
            this.logCacheError(
                "GETRAW",
                key,
                error,
            );

            return null;
        }
    }

    async setRaw (
        key: string,
        value: string,
        ttlSeconds: number,
    ): Promise<void> {
        try {
            if (!redis.isReady) {
                return;
            }

            await redis.set(
                key,
                value,
                {
                    expiration: {
                        type: "EX",
                        value: ttlSeconds,
                    },
                },
            );
        } catch (error) {
            // console.error(
            //     `[CACHE SET ERROR] ${key}`,
            //     error,
            // );
            this.logCacheError(
                "SETRAW",
                key,
                error,
            );
        }
    }
}