/**
 * Stats Worker
 *
 * Runs periodically to:
 * 1. Update feeder online/offline status
 * 2. Collect and store feeder statistics
 * 3. Create hourly snapshots for historical data
 *
 * Run with: npm run worker
 * Or: npx tsx scripts/stats-worker.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Configuration
const POLL_INTERVAL = 60 * 1000; // 1 minute
const OFFLINE_THRESHOLD = 5 * 60 * 1000; // 5 minutes without data = offline
const SNAPSHOT_INTERVAL = 60 * 60 * 1000; // 1 hour

// readsb stats endpoint
const READSB_STATS_URL =
  process.env.READSB_STATS_URL || "http://localhost:8080/data/stats.json";

interface ReadsbStats {
  now: number;
  aircraft_with_pos: number;
  aircraft_without_pos: number;
  total: {
    messages_valid: number;
    position_count_total: number;
    tracks: {
      all: number;
    };
  };
  last1min: {
    messages_valid: number;
    position_count_total: number;
  };
}

// Track previous stats for delta calculation
let previousStats: { messages: number; positions: number } | null = null;

/**
 * Fetch stats from readsb
 */
async function fetchStats(): Promise<ReadsbStats | null> {
  try {
    const response = await fetch(READSB_STATS_URL);
    if (!response.ok) {
      console.error(`Failed to fetch stats: ${response.status}`);
      return null;
    }
    return response.json();
  } catch (error) {
    console.error("Error fetching stats:", error);
    return null;
  }
}

/**
 * Update feeder stats from readsb data
 * Since readsb doesn't track individual feeders, we update all online feeders
 * For single-feeder setups, this works perfectly
 * For multi-feeder, we'd need to implement UUID tracking in readsb
 */
async function updateFeederStats() {
  console.log(`[${new Date().toISOString()}] Updating feeder stats...`);

  const stats = await fetchStats();

  if (!stats) {
    console.log("  No stats available from readsb");
    // Mark all feeders as offline if we can't reach the aggregator
    await prisma.feeder.updateMany({
      where: { isOnline: true },
      data: { isOnline: false },
    });
    return;
  }

  // Get all feeders
  const feeders = await prisma.feeder.findMany();

  if (feeders.length === 0) {
    console.log("  No feeders registered");
    return;
  }

  // Check if we're receiving data (messages in last minute > 0)
  const isReceivingData = stats.last1min?.messages_valid > 0;

  if (isReceivingData) {
    // For single feeder setup, attribute all stats to the first/only feeder
    // For multi-feeder, this would need to be distributed based on UUID tracking
    const totalMessages = stats.total?.messages_valid || 0;
    const totalPositions = stats.total?.position_count_total || 0;
    const aircraftTracked = stats.total?.tracks?.all || 0;

    // Update each feeder (for single feeder this is fine,
    // for multi-feeder we'd split the stats)
    for (const feeder of feeders) {
      await prisma.feeder.update({
        where: { id: feeder.id },
        data: {
          messagesTotal: BigInt(totalMessages),
          positionsTotal: BigInt(totalPositions),
          aircraftSeen: aircraftTracked,
          lastSeen: new Date(),
          isOnline: true,
        },
      });

      console.log(
        `  Updated ${feeder.name}: ${totalMessages.toLocaleString()} msgs, ${totalPositions.toLocaleString()} pos, ${aircraftTracked} aircraft`
      );
    }

    // Store for delta calculation
    previousStats = { messages: totalMessages, positions: totalPositions };
  } else {
    console.log("  No data received in last minute");
  }

  // Mark feeders as offline if not seen recently
  const offlineThreshold = new Date(Date.now() - OFFLINE_THRESHOLD);
  const offlineResult = await prisma.feeder.updateMany({
    where: {
      OR: [{ lastSeen: { lt: offlineThreshold } }, { lastSeen: null }],
      isOnline: true,
    },
    data: {
      isOnline: false,
    },
  });

  if (offlineResult.count > 0) {
    console.log(`  Marked ${offlineResult.count} feeders as offline`);
  }

  // Auto-upgrade users with active feeders to FEEDER tier
  const usersWithActiveFeeders = await prisma.user.findMany({
    where: {
      feeders: {
        some: {
          isOnline: true,
        },
      },
      apiTier: "FREE",
    },
  });

  for (const user of usersWithActiveFeeders) {
    await prisma.user.update({
      where: { id: user.id },
      data: { apiTier: "FEEDER" },
    });
    console.log(`  Upgraded ${user.email} to FEEDER tier`);
  }

  // Downgrade users with no active feeders back to FREE
  const usersToDowngrade = await prisma.user.findMany({
    where: {
      apiTier: "FEEDER",
      feeders: {
        none: {
          isOnline: true,
        },
      },
    },
  });

  for (const user of usersToDowngrade) {
    await prisma.user.update({
      where: { id: user.id },
      data: { apiTier: "FREE" },
    });
    console.log(`  Downgraded ${user.email} to FREE tier`);
  }
}

/**
 * Create hourly snapshots for all feeders
 */
async function createSnapshots() {
  console.log(`[${new Date().toISOString()}] Creating hourly snapshots...`);

  const feeders = await prisma.feeder.findMany({
    where: {
      isOnline: true,
    },
    include: {
      stats: {
        orderBy: { timestamp: "desc" },
        take: 1,
      },
    },
  });

  for (const feeder of feeders) {
    const lastSnapshot = feeder.stats[0];

    // Calculate delta since last snapshot
    const messagesDelta = lastSnapshot
      ? Number(feeder.messagesTotal) - (lastSnapshot.messages || 0)
      : Number(feeder.messagesTotal);

    const positionsDelta = lastSnapshot
      ? Number(feeder.positionsTotal) - (lastSnapshot.positions || 0)
      : Number(feeder.positionsTotal);

    await prisma.feederStats.create({
      data: {
        feederId: feeder.id,
        messages: messagesDelta > 0 ? messagesDelta : 0,
        positions: positionsDelta > 0 ? positionsDelta : 0,
        aircraft: feeder.aircraftSeen,
      },
    });

    console.log(
      `  Snapshot for ${feeder.name}: ${messagesDelta.toLocaleString()} msgs, ${positionsDelta.toLocaleString()} pos`
    );
  }

  // Clean up old snapshots (keep 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const deleted = await prisma.feederStats.deleteMany({
    where: {
      timestamp: { lt: thirtyDaysAgo },
    },
  });

  if (deleted.count > 0) {
    console.log(`  Cleaned up ${deleted.count} old snapshots`);
  }
}

/**
 * Get network-wide statistics
 */
async function logNetworkStats() {
  const [totalFeeders, onlineFeeders, totals] = await Promise.all([
    prisma.feeder.count(),
    prisma.feeder.count({ where: { isOnline: true } }),
    prisma.feeder.aggregate({
      _sum: {
        messagesTotal: true,
        positionsTotal: true,
        aircraftSeen: true,
      },
    }),
  ]);

  console.log(`[${new Date().toISOString()}] Network Stats:`);
  console.log(`  Feeders: ${onlineFeeders}/${totalFeeders} online`);
  console.log(
    `  Messages: ${(totals._sum.messagesTotal || BigInt(0)).toLocaleString()}`
  );
  console.log(
    `  Positions: ${(totals._sum.positionsTotal || BigInt(0)).toLocaleString()}`
  );
  console.log(`  Aircraft Tracked: ${totals._sum.aircraftSeen || 0}`);
}

/**
 * Main worker loop
 */
async function main() {
  console.log("=".repeat(50));
  console.log("HangarTrak Radar Stats Worker");
  console.log("=".repeat(50));
  console.log(`Poll Interval: ${POLL_INTERVAL / 1000}s`);
  console.log(`Snapshot Interval: ${SNAPSHOT_INTERVAL / 1000}s`);
  console.log(`Stats URL: ${READSB_STATS_URL}`);
  console.log("=".repeat(50));

  let lastSnapshotTime = 0;

  // Initial run
  await updateFeederStats();
  await logNetworkStats();

  // Continuous loop
  setInterval(async () => {
    try {
      await updateFeederStats();

      // Create snapshots hourly
      const now = Date.now();
      if (now - lastSnapshotTime >= SNAPSHOT_INTERVAL) {
        await createSnapshots();
        lastSnapshotTime = now;
      }

      await logNetworkStats();
    } catch (error) {
      console.error("Worker error:", error);
    }
  }, POLL_INTERVAL);
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

main().catch(async (error) => {
  console.error("Fatal error:", error);
  await prisma.$disconnect();
  process.exit(1);
});
