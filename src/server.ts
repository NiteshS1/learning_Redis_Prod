import "dotenv/config";

import { app } from "./app.js";
import { prisma } from "./database/prisma.js";

const PORT = Number(process.env.PORT) || 3000;

/**
 * Connects to PostgreSQL, starts the application server, and configures graceful shutdown handling.
 */
async function bootstrap() {
  try {
    await prisma.$connect();

    console.log("PostgreSQL connected");

    const server = app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });

    const shutdown = async (signal: string) => {
      console.log(`${signal} received. Shutting down gracefully...`);

      server.close(async () => {
        await prisma.$disconnect();

        console.log("PostgreSQL disconnected");
        console.log("Server closed");

        process.exit(0);
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    console.error("Failed to start application:", error);

    await prisma.$disconnect();

    process.exit(1);
  }
}

bootstrap();