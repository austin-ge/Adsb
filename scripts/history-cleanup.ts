/**
 * History Cleanup - Deletes aircraft position data older than the retention period.
 *
 * Run with: npx tsx scripts/history-cleanup.ts
 *
 * Should be run periodically (e.g., once per hour via cron) to keep database size manageable.
 *
 * Environment variables:
 *   HISTORY_RETENTION_HOURS - How many hours of history to keep (default: 24)
 *   DATABASE_URL - PostgreSQL connection string
 */

import { PrismaClient } from "@prisma/client";

const RETENTION_HOURS = parseInt(process.env.HISTORY_RETENTION_HOURS || "24");
const prisma = new PrismaClient();

async function cleanup() {
  const cutoff = new Date(Date.now() - RETENTION_HOURS * 60 * 60 * 1000);

  console.log(`Cleaning up aircraft positions older than ${cutoff.toISOString()}`);
  console.log(`Retention: ${RETENTION_HOURS} hours`);

  const result = await prisma.aircraftPosition.deleteMany({
    where: {
      timestamp: { lt: cutoff },
    },
  });

  console.log(`Deleted ${result.count} old position records`);

  await prisma.$disconnect();
}

cleanup().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
