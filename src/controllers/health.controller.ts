import type {
  Request,
  Response,
} from "express";

import { prisma } from "../database/prisma.js";

export async function readinessCheck(
  _req: Request,
  res: Response,
) {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return res.status(200).json({
      status: "ready",
      dependencies: {
        postgres: "up",
      },
    });
  } catch {
    return res.status(503).json({
      status: "not_ready",
      dependencies: {
        postgres: "down",
      },
    });
  }
}