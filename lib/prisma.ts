import { PrismaClient } from "@prisma/client";

/**
 * Shared Prisma client for the Next.js application.
 *
 * Uses the global singleton pattern to prevent connection exhaustion during
 * development (hot reloading) and serverless function scaling in production.
 *
 * Connection pooling is configured via DATABASE_URL query parameters:
 * - connection_limit: Max connections per Prisma instance (default: 5 for serverless)
 * - pool_timeout: Max wait time for connection from pool (default: 10s)
 *
 * Example: postgresql://user:pass@host:5432/db?connection_limit=5&pool_timeout=10
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
