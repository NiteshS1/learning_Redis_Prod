import { randomBytes } from "node:crypto";

export function generateSessionId() {
  return randomBytes(32)
    .toString("base64url");
}