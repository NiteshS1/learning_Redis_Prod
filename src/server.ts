import "dotenv/config";

import { app } from "./app.js";
import { prisma } from "./database/prisma.js";
import { redis } from "./database/redis.js";

const PORT = Number(process.env.PORT) || 3000;

async function bootstrap () {
  try {
    await prisma.$connect();
    console.log("[POSTGRES] Connected");

    await redis.connect();
    console.log("[REDIS] Connected");

    const server = app.listen(PORT, () => {
      console.log(
        `[HTTP] Server running on http://localhost:${PORT}`,
      );
    });

    let shuttingDown = false;

    // await redis.set(
    //   "lab:hello",
    //   "full-power-redis",
    // );
    // const value = await redis.get("lab:hello");
    // console.log(value);

    const shutdown = async (signal: string) => {
      if (shuttingDown) {
        return;
      }

      shuttingDown = true;

      console.log(
        `[SHUTDOWN] ${signal} received`,
      );

      server.close(async () => {
        try {
          await Promise.allSettled([
            prisma.$disconnect(),
            redis.isOpen
              ? redis.close()
              : Promise.resolve(),
          ]);

          console.log(
            "[SHUTDOWN] Dependencies closed",
          );
        } finally {
          process.exit(0);
        }
      });
    };

    process.on("SIGINT", () =>
      shutdown("SIGINT"),
    );

    process.on("SIGTERM", () =>
      shutdown("SIGTERM"),
    );
  } catch (error) {
    console.error(
      "[BOOTSTRAP] Failed:",
      error,
    );

    await Promise.allSettled([
      prisma.$disconnect(),
      redis.isOpen
        ? redis.close()
        : Promise.resolve(),
    ]);

    process.exit(1);
  }
}

bootstrap();