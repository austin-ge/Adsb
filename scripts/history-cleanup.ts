/**
 * History Cleanup - Deletes aircraft position data older than the retention period.
 *
 * Run with: npx tsx scripts/history-cleanup.ts
 *
 * By default, runs once and exits (for PM2 cron_restart).
 * Set CLEANUP_LOOP=true to run continuously with internal timing (for local dev).
 *
 * Environment variables:
 *   HISTORY_RETENTION_HOURS - How many hours of history to keep (default: 24)
 *   DATABASE_URL - PostgreSQL connection string
 *   CLEANUP_LOOP - Set to "true" to run in a loop (default: false)
 *   CLEANUP_INTERVAL_MS - Interval between runs in loop mode (default: 3600000 = 1 hour)
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const RETENTION_HOURS = parseInt(process.env.HISTORY_RETENTION_HOURS || "24");
const LOOP_MODE = process.env.CLEANUP_LOOP === "true";
const INTERVAL_MS = parseInt(process.env.CLEANUP_INTERVAL_MS || "3600000"); // 1 hour

const prisma = new PrismaClient();

async function cleanup() {
  const cutoff = new Date(Date.now() - RETENTION_HOURS * 60 * 60 * 1000);

  console.log(`[${new Date().toISOString()}] Cleaning up aircraft positions older than ${cutoff.toISOString()}`);
  console.log(`Retention: ${RETENTION_HOURS} hours`);

  const result = await prisma.aircraftPosition.deleteMany({
    where: {
      timestamp: { lt: cutoff },
    },
  });

  console.log(`Deleted ${result.count} old position records`);
}

async function main() {
  console.log("History Cleanup starting...");
  console.log(`Mode: ${LOOP_MODE ? "continuous loop" : "single run"}`);

  if (LOOP_MODE) {
    console.log(`Interval: ${INTERVAL_MS / 1000}s`);

    // Initial run
    await cleanup();

    // Continuous loop
    setInterval(async () => {
      try {
        await cleanup();
      } catch (error) {
        console.error("Cleanup error:", error);
      }
    }, INTERVAL_MS);
  } else {
    // Single run mode (for PM2 cron)
    await cleanup();
    await prisma.$disconnect();
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\nShutting down...");
  await prisma.$disconnect();
  process.exit(0);
});

main().catch(async (err) => {
  console.error("Cleanup failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
