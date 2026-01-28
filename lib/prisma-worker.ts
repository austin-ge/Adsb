import { PrismaClient } from "@prisma/client";

/**
 * Worker-specific Prisma client for long-running background processes.
 *
 * Workers (stats-worker, history-cleanup, flight-segmenter) run continuously
 * and should use fewer connections than serverless functions. This client:
 * - Uses a lower connection limit (default: 2 vs 5 for serverless)
 * - Logs errors only in production
 * - Does NOT use the global singleton (workers are separate processes)
 *
 * Configure via WORKER_DATABASE_URL or falls back to DATABASE_URL.
 * The worker URL should have a lower connection_limit:
 *   postgresql://user:pass@host:5432/db?connection_limit=2&pool_timeout=10
 */

/**
 * Create a Prisma client configured for worker processes.
 * Call this once at worker startup.
 */
export function createWorkerPrisma(): PrismaClient {
  // Workers can use a dedicated connection string with lower limits
  const workerUrl = process.env.WORKER_DATABASE_URL || process.env.DATABASE_URL;

  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
    datasources: workerUrl
      ? {
          db: {
            url: workerUrl,
          },
        }
      : undefined,
  });
}
