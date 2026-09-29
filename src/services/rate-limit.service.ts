import { redis } from "../database/redis.js";

import type {
  FixedWindowOptions,
  RateLimitResult,
} from "../types/rate-limit.js";

const FIXED_WINDOW_SCRIPT = `
  local current = redis.call("incr", KEYS[1])

  if current == 1 then
    redis.call("EXPIRE", KEYS[1], ARGV[1])
  end

  return current
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
}