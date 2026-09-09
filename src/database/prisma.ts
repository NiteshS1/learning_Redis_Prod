import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined");
}

const adapter = new PrismaPg({
  connectionString,

  max: 10,

  connectionTimeoutMillis: 5_000,

  idleTimeoutMillis: 30_000,
});

export const prisma = new PrismaClient({
  adapter,
});