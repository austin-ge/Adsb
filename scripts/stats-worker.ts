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

import "dotenv/config";
import { createWorkerPrisma } from "../lib/prisma-worker";

const prisma = createWorkerPrisma();

// Configuration
const POLL_INTERVAL = 60 * 1000; // 1 minute
const OFFLINE_THRESHOLD = 5 * 60 * 1000; // 5 minutes without data = offline
const SNAPSHOT_INTERVAL = 60 * 60 * 1000; // 1 hour

// Scoring weights (must sum to 1.0)
const SCORE_WEIGHTS = {
  uptime: 0.30,
  messageRate: 0.25,
  positionRate: 0.25,
  aircraftCount: 0.20,
};

// Target values for 100% score in each metric
const METRIC_TARGETS = {
  messageRate: 1000,    // msgs/min for 100 score
  positionRate: 500,    // pos/min for 100 score
  aircraftCount: 50,    // aircraft for 100 score
};

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
 * Calculate uptime percentage for a feeder based on recent FeederStats records.
 * Expected: 1 snapshot per hour. Returns (actual / expected) * 100, capped at 100.
 */
async function calculateUptimePercent(feederId: string, hours: number = 24): Promise<number> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const snapshotCount = await prisma.feederStats.count({
    where: {
      feederId,
      timestamp: { gte: since },
    },
  });

  // Expected snapshots = hours (1 per hour)
  const expectedSnapshots = hours;
  const uptimePercent = (snapshotCount / expectedSnapshots) * 100;

  // Cap at 100%
  return Math.min(100, uptimePercent);
}

/**
 * Calculate composite score from individual metrics.
 * Each metric is normalized to 0-100 based on targets, then weighted.
 */
function calculateScore(
  uptime: number,
  msgRate: number,
  posRate: number,
  aircraft: number
): number {
  // Normalize each metric to 0-100
  const uptimeNorm = Math.min(100, uptime);
  const msgRateNorm = Math.min(100, (msgRate / METRIC_TARGETS.messageRate) * 100);
  const posRateNorm = Math.min(100, (posRate / METRIC_TARGETS.positionRate) * 100);
  const aircraftNorm = Math.min(100, (aircraft / METRIC_TARGETS.aircraftCount) * 100);

  // Apply weights
  const weightedScore =
    uptimeNorm * SCORE_WEIGHTS.uptime +
    msgRateNorm * SCORE_WEIGHTS.messageRate +
    posRateNorm * SCORE_WEIGHTS.positionRate +
    aircraftNorm * SCORE_WEIGHTS.aircraftCount;

  // Return as integer 0-100
  return Math.round(weightedScore);
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

    const messages = messagesDelta > 0 ? messagesDelta : 0;
    const positions = positionsDelta > 0 ? positionsDelta : 0;

    // Calculate rates (per minute, assuming 60-minute snapshot interval)
    const messageRate = messages / 60;
    const positionRate = positions / 60;

    // Calculate uptime for this feeder (24-hour window)
    const uptimePercent = await calculateUptimePercent(feeder.id, 24);

    // Calculate composite score
    const score = calculateScore(
      uptimePercent,
      messageRate,
      positionRate,
      feeder.aircraftSeen
    );

    // Create the snapshot with all metrics
    await prisma.feederStats.create({
      data: {
        feederId: feeder.id,
        messages,
        positions,
        aircraft: feeder.aircraftSeen,
        messageRate,
        positionRate,
        uptimePercent,
        score,
      },
    });

    // Update the feeder's current score
    await prisma.feeder.update({
      where: { id: feeder.id },
      data: { currentScore: score },
    });

    console.log(
      `  Snapshot for ${feeder.name}: ${messages.toLocaleString()} msgs, ${positions.toLocaleString()} pos, score=${score}, uptime=${uptimePercent.toFixed(1)}%`
    );
  }

  // Update rankings for all feeders
  await updateFeederRanks();

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
 * Update feeder rankings based on current scores.
 * Preserves previousRank for calculating rank changes.
 */
async function updateFeederRanks(): Promise<void> {
  console.log(`  Updating feeder rankings...`);

  // Get all feeders ordered by score (highest first)
  const feeders = await prisma.feeder.findMany({
    orderBy: { currentScore: "desc" },
    select: {
      id: true,
      name: true,
      currentScore: true,
      currentRank: true,
    },
  });

  // Update each feeder's rank
  for (let i = 0; i < feeders.length; i++) {
    const feeder = feeders[i];
    const newRank = i + 1; // 1-indexed rank

    await prisma.feeder.update({
      where: { id: feeder.id },
      data: {
        previousRank: feeder.currentRank,
        currentRank: newRank,
      },
    });
  }

  console.log(`  Updated ranks for ${feeders.length} feeders`);
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
