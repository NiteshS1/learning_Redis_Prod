export interface RateLimitResult {
    allowed: boolean;

    limit: number;

    remaining: number;

    retryAfterSeconds: number;

    resetAt: number;
}

export interface FixedWindowOptions {
    scope: string;

    identifier: string;

    limit: number;

    windowSeconds: number;
}