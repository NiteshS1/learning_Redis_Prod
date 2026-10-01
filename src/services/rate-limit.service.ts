import { randomUUID } from "node:crypto";
import { redis } from "../database/redis.js";

import type {
  FixedWindowOptions,
  RateLimitResult,
  SlidingWindowOptions,
} from "../types/rate-limit.js";

const FIXED_WINDOW_SCRIPT = `
  local current = redis.call("incr", KEYS[1])

  if current == 1 then
    redis.call("EXPIRE", KEYS[1], ARGV[1])
  end

  return current
`;

const SLIDING_WINDOW_SCRIPT = `
  local key =
    KEYS[1]

  local now =
    tonumber(ARGV[1])

  local windowMs =
    tonumber(ARGV[2])

  local limit =
    tonumber(ARGV[3])

  local member =
    ARGV[4]

  local windowStart =
    now - windowMs

  redis.call(
    "ZREMRANGEBYSCORE",
    key,
    "-inf",
    windowStart
  )

  local current =
    redis.call(
      "ZCARD",
      key
    )

  if current >= limit then
    local oldest =
      redis.call(
        "ZRANGE",
        key,
        0,
        0,
        "WITHSCORES"
      )

    local retryAfterMs =
      windowMs

    if oldest[2] then
      retryAfterMs =
        windowMs -
        (
          now -
          tonumber(
            oldest[2]
          )
        )
    end

    return {
      0,
      current,
      retryAfterMs
    }
  end

  redis.call(
    "ZADD",
    key,
    now,
    member
  )

  redis.call(
    "PEXPIRE",
    key,
    windowMs
  )

  return {
    1,
    current + 1,
    0
  }
`;

export class RateLimitService {
  async fixedWindow(
    options: FixedWindowOptions,
  ): Promise<RateLimitResult> {
    const {
      scope,
      identifier,
      limit,
      windowSeconds,
    } = options;

    if (!redis.isReady) {
      throw new Error(
        "RATE_LIMIT_STORE_UNAVAILABLE",
      );
    }

    const now = Date.now();

    const windowMs =
      windowSeconds * 1000;

    const windowId =
      Math.floor(
        now / windowMs,
      );

    const key =
      `rate-limit:${scope}:${identifier}:${windowId}`;

    const count = await redis.eval(
      FIXED_WINDOW_SCRIPT,
      {
        keys: [key],
        arguments: [
          String(windowSeconds),
        ],
      },
    );

    const current = Number(count);

    const windowEnd = (windowId + 1) * windowMs;

    const retryAfterSeconds =
      Math.max(
        1,
        Math.ceil(
          (windowEnd - now) /
          1000,
        ),
      );

    return {
      allowed:
        current <= limit,

      limit,

      remaining:
        Math.max(
          0,
          limit - current,
        ),

      retryAfterSeconds,

      resetAt: windowEnd,
    };
  }

  async slidingWindow(
    options: SlidingWindowOptions,
  ): Promise<RateLimitResult> {
    const {
      scope,
      identifier,
      limit,
      windowSeconds,
    } = options;

    if (!redis.isReady) {
      throw new Error(
        "RATE_LIMIT_STORE_UNAVAILABLE",
      );
    }

    const now = Date.now();

    const windowMs = windowSeconds * 1000;

    const key = `rate-limit:sliding:${scope}:${identifier}`;

    const member = `${now}:${randomUUID()}`;

    const result = await redis.eval(SLIDING_WINDOW_SCRIPT, {
      keys: [key],
      arguments: [
        String(now),
        String(windowMs),
        String(limit),
        member,
      ],
    });

    if (!Array.isArray(result)) {
      throw new Error(
        "Unexpected rate limit response",
      );
    }

    const allowed = Number(result[0]) === 1;

    const current = Number(result[1]);

    const retryAfterMs = Number(result[2]);

    return {
      allowed,
      limit,
      remaining: Math.max(0, limit - current),
      retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil(retryAfterMs / 1000)),
      resetAt: allowed ? now + windowMs : now + retryAfterMs,
    }

  }
}