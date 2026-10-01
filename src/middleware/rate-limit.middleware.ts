import { NextFunction, Request, Response } from "express";
import { RateLimitService } from "../services/rate-limit.service";

export interface RateLimitMiddlewareOptions {
    scope: string;

    limit: number;

    windowSeconds: number;

    algorithm?:
    | "fixed"
    | "sliding";

    failureMode?:
    | "open"
    | "closed";

    getIdentifier: (req: Request) => string;
}

export class RateLimitMiddleware {
    constructor(
        private readonly ratelimitService: RateLimitService,
    ) { }

    create(options: RateLimitMiddlewareOptions) {
        return async (req: Request, res: Response, next: NextFunction) => {
            try {
                const identifier = options.getIdentifier(req);

                const result = options.algorithm === "sliding" ?
                    await this.ratelimitService.slidingWindow({
                        scope: options.scope,
                        identifier,
                        limit: options.limit,
                        windowSeconds: options.windowSeconds,
                    }) : await this.ratelimitService.fixedWindow({
                        scope: options.scope,
                        identifier,
                        limit: options.limit,
                        windowSeconds: options.windowSeconds,
                    });

                res.setHeader("RateLimit-Limit", String(result.limit));

                res.setHeader("RateLimit-Remaining", String(result.remaining));

                res.setHeader("RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));

                if (!result.allowed) {
                    res.setHeader("Retry-After", String(result.retryAfterSeconds));

                    return res.status(429).json({
                        success: false,

                        error: {
                            code: "RATE_LIMIT_EXCEEDED",
                            message: "Too many requests",
                        },
                    });
                }

                next();
            } catch (error) {
                if (
                  error instanceof Error &&
                  error.message ===
                    "RATE_LIMIT_STORE_UNAVAILABLE"
                ) {
                  const failureMode =
                    options.failureMode ??
                    "open";
              
                  if (
                    failureMode ===
                    "open"
                  ) {
                    console.warn(
                      `[RATE LIMIT FAIL-OPEN] scope=${options.scope}`,
                    );
              
                    return next();
                  }
              
                  return res
                    .status(503)
                    .json({
                      success: false,
              
                      error: {
                        code:
                          "RATE_LIMIT_STORE_UNAVAILABLE",
              
                        message:
                          "Request protection service temporarily unavailable",
                      },
                    });
                }
              
                next(error);
              }
        };
    }
}