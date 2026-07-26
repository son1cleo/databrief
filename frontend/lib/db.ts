import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/lib/generated/prisma/client";
import ws from "ws";

// Prisma 7 requires an explicit driver adapter (no more built-in engine) —
// Neon's serverless driver needs a WebSocket implementation in Node.js.
neonConfig.webSocketConstructor = ws;

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createClient() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

// Reuse a single client across hot reloads in dev and across warm serverless
// invocations in production so we don't exhaust Neon's connection pool.
export const prisma = global.__prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
