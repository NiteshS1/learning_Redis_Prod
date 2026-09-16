import type {
  Request,
  Response,
} from "express";

import { prisma } from "../database/prisma.js";
import { redis } from "../database/redis.js";

export async function readinessCheck (
  _req: Request,
  res: Response,
) {
  try {
    await prisma.$queryRaw`SELECT 1`;

    const redisStatus =
      redis.isReady
        ? "up"
        : "down";

    return res.status(200).json({
      status: "ready",

      mode:
        redisStatus === 'up'
          ? "normal"
          : "degraded",

      dependencies: {
        postgres: "up",
        redis: redisStatus,
      },
    });
  } catch {
    return res.status(503).json({
      status: "not_ready",
      dependencies: {
        postgres: "down",
        redis:
          redis.isReady
            ? "up"
            : "down",
      },
    });
  }
}