import "dotenv/config";

import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL is not defined");
}

export const redis = createClient({
  url: redisUrl,
});

redis.on("error", (error) => {
  console.error("[REDIS ERROR]", error);
});

redis.on("connect", () => {
  console.log("[REDIS] Socket connected");
});

redis.on("ready", () => {
  console.log("[REDIS] Ready");
});

redis.on("reconnecting", () => {
  console.log("[REDIS] Reconnecting...");
});

redis.on("end", () => {
  console.log("[REDIS] Connection closed");
});