import { hashSessionId, redisKeys } from "../config/redis-keys";
import { sessionConfig } from "../config/session.config";
import { redis } from "../database/redis";
import { SessionData } from "../types/session";
import { generateSessionId } from "../utils/session-token";

export interface CreatedSession {
    sessionId: string;
    session: SessionData;
    ttlSeconds: number;
}

export class SessionService {
    private assertRedisAvailable() {
        if (!redis.isReady) {
            throw new Error(
                "SESSION_STORE_UNAVAILABLE",
            );
        }
    }

    private calculateTtlSeconds(
        session: SessionData,
        now: number,
    ): number {
        const remainingAbsoluteMs =
            session.absoluteExpiresAt -
            now;

        if (remainingAbsoluteMs <= 0) {
            return 0;
        }

        const remainingAbsoluteSeconds = Math.ceil(remainingAbsoluteMs / 1000);

        return Math.min(
            sessionConfig.idleTtlSeconds,
            remainingAbsoluteSeconds,
        );
    }

    async createSession(
        userId: string,
    ): Promise<CreatedSession> {
        this.assertRedisAvailable();

        const sessionId = generateSessionId();

        const sessionHash = hashSessionId(sessionId);

        const key = redisKeys.sessionByHash(sessionHash);

        const userSessionsKey = redisKeys.userSessions(userId);

        const now = Date.now();

        const absoluteExpiresAt =
            now +
            sessionConfig
                .absoluteTtlSeconds * 1000;

        const session: SessionData = {
            userId,
            createdAt: now,
            lastAccessedAt: now,
            absoluteExpiresAt,
        };

        const ttlSeconds = this.calculateTtlSeconds(
            session,
            now
        );

        // await redis.set(
        //     key,
        //     JSON.stringify(session),
        //     {
        //         expiration: {
        //             type: "EX",
        //             value: ttlSeconds,
        //         }
        //     },
        // );

        const transaction = redis.multi();

        transaction.set(
            key,
            JSON.stringify(session),
            {
                expiration: {
                    type: "EX",
                    value: ttlSeconds,
                },
            },
        );

        transaction.sAdd(
            userSessionsKey,
            sessionHash,
        );

        await transaction.exec();

        console.log(
            `[SESSION CREATED] ${key} TTL=${ttlSeconds}s`,
        );

        return {
            sessionId,
            session,
            ttlSeconds
        };
    };

    async getSession(
        sessionId: string,
    ): Promise<SessionData | null> {
        this.assertRedisAvailable();

        const key = redisKeys.session(sessionId);

        const raw = await redis.get(key);

        if (raw === null) {
            return null;
        }

        const session = JSON.parse(raw) as SessionData;

        const now = Date.now();

        if (now >= session.absoluteExpiresAt) {
            await redis.del(key);

            console.log(`[SESSION ABSOLUTE EXPIRED] ${key}`,);

            return null;
        }

        return session;
    }

    async touchSession(sessionId: string, session: SessionData): Promise<number> {
        this.assertRedisAvailable();

        const key = redisKeys.session(sessionId);

        const now = Date.now();

        if (now >= session.absoluteExpiresAt) {
            await redis.del(key);
            return 0;
        }

        const updatedSession: SessionData = {
            ...session,
            lastAccessedAt: now,
        };

        const ttlSeconds = this.calculateTtlSeconds(
            updatedSession,
            now,
        );

        if (ttlSeconds <= 0) {
            await redis.del(key);
            return 0;
        }

        await redis.set(
            key,
            JSON.stringify(
                updatedSession,
            ),
            {
                expiration: {
                    type: "EX",
                    value: ttlSeconds,
                },
            },
        );

        return ttlSeconds;
    }

    // async deleteSession (sessionId: string): Promise<void> {
    //     this.assertRedisAvailable();

    //     const key = redisKeys.session(sessionId);

    //     await redis.del(key);

    //     console.log(`[SESSION DELETED] ${key}`);
    // }

    async deleteSession(sessionId: string, userId: string): Promise<void> {
        this.assertRedisAvailable();

        const sessionHash = hashSessionId(sessionId);

        const sessionKey = redisKeys.sessionByHash(sessionHash);

        const userSessionsKey = redisKeys.userSessions(userId);

        const transaction = redis.multi();

        transaction.del(sessionKey);

        transaction.sRem(userSessionsKey, sessionHash);

        await transaction.exec();

        console.log(`[SESSION DELETED] ${sessionKey}`);
    }

    async deleteAllUserSessions(userId: string): Promise<number> {
        this.assertRedisAvailable();

        const indexKey = redisKeys.userSessions(userId);

        const sessionHashes = await redis.sMembers(indexKey);

        if (sessionHashes.length === 0) {
            return 0;
        }

        const transaction = redis.multi();

        for (const sessionHash of sessionHashes) {
            transaction.del(
                redisKeys.sessionByHash(
                    sessionHash,
                ),
            );
        }

        transaction.del(indexKey);

        await transaction.exec();

        console.log(
            `[ALL USER SESSIONS DELETED] user=${userId} count=${sessionHashes.length}`,
        );

        return sessionHashes.length;
    }

    async listActiveUserSessions(userId: string): Promise<String[]> {
        this.assertRedisAvailable();

        const indexKey = redisKeys.userSessions(userId);

        const sessionHashes = await redis.sMembers(indexKey);

        if(sessionHashes.length === 0) {
            return [];
        }

        const active: string[] = [];
        const stale: string[] = [];

        for (const sessionHash of sessionHashes) {
            const exists = await redis.exists(redisKeys.sessionByHash(sessionHash));

            if(exists === 1) {
                active.push(sessionHash);
            } else {
                stale.push(sessionHash);
            }
        }
        
        if (stale.length > 0) {
            await redis.sRem(indexKey, stale);
        }

        return active;
    }
}