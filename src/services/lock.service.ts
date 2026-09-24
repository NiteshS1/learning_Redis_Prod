import { randomUUID } from "node:crypto";

import { redis } from "../database/redis.js";

export interface Lock {
    key: string;
    token: string;
}

export type LockAcquireResult =
    | {
        status: "acquired";
        lock: Lock;
    }
    | {
        status: "contended";
    }
    | {
        status: "unavailable";
    };

export class LockService {
    async acquire(
        key: string,
        ttlMs = 5000,
    ): Promise<LockAcquireResult> {
        if (!redis.isReady) {
            return {
                status: "unavailable",
            };
        }

        const token = randomUUID();

        try {
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
                console.log(
                    `[LOCK CONTENDED] ${key}`,
                );

                return {
                    status: "contended",
                };
            }

            console.log(
                `[LOCK ACQUIRED] ${key}`,
            );

            return {
                status: "acquired",
                lock: {
                    key,
                    token,
                },
            };
        } catch (error) {
            console.error(
                `[LOCK ACQUIRE ERROR] ${key}`,
                error,
            );

            return {
                status: "unavailable",
            };
        }
    }

    async release(
        lock: Lock,
    ): Promise<boolean> {
        if (!redis.isReady) {
            return false;
        }

        try {
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

            if (result === 1) {
                console.log(
                    `[LOCK RELEASED] ${lock.key}`,
                );

                return true;
            }

            console.warn(
                `[LOCK RELEASE SKIPPED] ${lock.key}`,
            );

            return false;
        } catch (error) {
            console.error(
                `[LOCK RELEASE ERROR] ${lock.key}`,
                error,
            );

            return false;
        }
    }
}