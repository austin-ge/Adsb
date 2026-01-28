/**
 * Flight Segmenter - Detects flight segments from AircraftPosition data and creates Flight records.
 *
 * Run with: npx tsx scripts/flight-segmenter.ts
 *
 * By default, runs once and exits (for PM2 cron_restart).
 * Set SEGMENTER_LOOP=true to run continuously with internal timing (for local dev).
 *
 * Algorithm:
 * 1. Query distinct hex values with positions in the last 30 minutes
 * 2. For each hex, get all positions ordered by timestamp
 * 3. Detect gaps > 15 minutes = new flight boundary
 * 4. For each detected flight:
 *    - Compute stats: max altitude, total distance (haversine), duration
 *    - Downsample positions to ~30s intervals
 *    - Create Flight record with embedded positions JSON
 * 5. Avoid duplicates - check if flight exists for hex+startTime (within 1 minute tolerance)
 *
 * Environment variables:
 *   DATABASE_URL - PostgreSQL connection string
 *   LOOKBACK_MINUTES - How far back to look for positions (default: 30)
 *   GAP_THRESHOLD_MINUTES - Time gap to split flights (default: 15)
 *   SEGMENTER_LOOP - Set to "true" to run in a loop (default: false)
 *   SEGMENTER_INTERVAL_MS - Interval between runs in loop mode (default: 300000 = 5 min)
 */

import { PrismaClient, Prisma } from "@prisma/client";

const LOOKBACK_MINUTES = parseInt(process.env.LOOKBACK_MINUTES || "30");
const GAP_THRESHOLD_MS =
  parseInt(process.env.GAP_THRESHOLD_MINUTES || "15") * 60 * 1000;
const DOWNSAMPLE_INTERVAL_MS = 30 * 1000; // 30 seconds between positions
const ALTITUDE_CHANGE_THRESHOLD = 500; // Keep positions with >500ft altitude change
const LOOP_MODE = process.env.SEGMENTER_LOOP === "true";
const INTERVAL_MS = parseInt(process.env.SEGMENTER_INTERVAL_MS || "300000"); // 5 minutes

const prisma = new PrismaClient();

interface Position {
  lat: number;
  lon: number;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
  flight: string | null;
  timestamp: Date;
}

interface CompactPosition {
  lat: number;
  lon: number;
  alt: number | null;
  hdg: number | null;
  spd: number | null;
  ts: number;
}

/**
 * Haversine formula to calculate distance between two points in nautical miles
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3440.065; // Earth radius in nautical miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Split positions into flight segments based on time gaps
 */
function segmentFlights(positions: Position[]): Position[][] {
  if (positions.length === 0) return [];

  const segments: Position[][] = [];
  let currentSegment: Position[] = [positions[0]];

  for (let i = 1; i < positions.length; i++) {
    const gap =
      positions[i].timestamp.getTime() -
      positions[i - 1].timestamp.getTime();

    if (gap > GAP_THRESHOLD_MS) {
      // New flight segment
      if (currentSegment.length >= 2) {
        segments.push(currentSegment);
      }
      currentSegment = [positions[i]];
    } else {
      currentSegment.push(positions[i]);
    }
  }

  // Add final segment
  if (currentSegment.length >= 2) {
    segments.push(currentSegment);
  }

  return segments;
}

/**
 * Downsample positions to ~30s intervals, keeping significant altitude changes
 */
function downsamplePositions(positions: Position[]): CompactPosition[] {
  if (positions.length === 0) return [];
  if (positions.length <= 2) {
    return positions.map((p) => ({
      lat: p.lat,
      lon: p.lon,
      alt: p.altitude,
      hdg: p.heading,
      spd: p.speed,
      ts: p.timestamp.getTime(),
    }));
  }

  const result: CompactPosition[] = [];
  let lastKeptIndex = 0;
  let lastKeptAltitude = positions[0].altitude;

  // Always keep first position
  result.push({
    lat: positions[0].lat,
    lon: positions[0].lon,
    alt: positions[0].altitude,
    hdg: positions[0].heading,
    spd: positions[0].speed,
    ts: positions[0].timestamp.getTime(),
  });

  for (let i = 1; i < positions.length - 1; i++) {
    const timeSinceLast =
      positions[i].timestamp.getTime() -
      positions[lastKeptIndex].timestamp.getTime();

    // Keep every ~30s (every 3rd position at 10s intervals)
    const shouldKeepByTime = timeSinceLast >= DOWNSAMPLE_INTERVAL_MS;

    // Keep significant altitude changes
    const currentAlt = positions[i].altitude;
    const altitudeChange =
      lastKeptAltitude !== null && currentAlt !== null
        ? Math.abs(currentAlt - lastKeptAltitude)
        : 0;
    const shouldKeepByAltitude = altitudeChange > ALTITUDE_CHANGE_THRESHOLD;

    if (shouldKeepByTime || shouldKeepByAltitude) {
      result.push({
        lat: positions[i].lat,
        lon: positions[i].lon,
        alt: positions[i].altitude,
        hdg: positions[i].heading,
        spd: positions[i].speed,
        ts: positions[i].timestamp.getTime(),
      });
      lastKeptIndex = i;
      lastKeptAltitude = positions[i].altitude;
    }
  }

  // Always keep last position
  const lastPos = positions[positions.length - 1];
  result.push({
    lat: lastPos.lat,
    lon: lastPos.lon,
    alt: lastPos.altitude,
    hdg: lastPos.heading,
    spd: lastPos.speed,
    ts: lastPos.timestamp.getTime(),
  });

  return result;
}

/**
 * Compute flight statistics from positions
 */
function computeFlightStats(positions: Position[]): {
  maxAltitude: number | null;
  totalDistance: number;
  durationSecs: number;
  callsign: string | null;
} {
  let maxAltitude: number | null = null;
  let totalDistance = 0;
  let callsign: string | null = null;

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];

    // Track max altitude
    if (pos.altitude !== null) {
      if (maxAltitude === null || pos.altitude > maxAltitude) {
        maxAltitude = pos.altitude;
      }
    }

    // Use most common callsign (usually the last non-null one)
    if (pos.flight) {
      callsign = pos.flight.trim();
    }

    // Calculate distance from previous position
    if (i > 0) {
      const prev = positions[i - 1];
      totalDistance += haversineDistance(prev.lat, prev.lon, pos.lat, pos.lon);
    }
  }

  const durationSecs = Math.floor(
    (positions[positions.length - 1].timestamp.getTime() -
      positions[0].timestamp.getTime()) /
      1000
  );

  return { maxAltitude, totalDistance, durationSecs, callsign };
}

/**
 * Check if a flight already exists for this hex at approximately this start time
 */
async function flightExists(
  hex: string,
  startTime: Date
): Promise<boolean> {
  const tolerance = 60 * 1000; // 1 minute tolerance
  const existing = await prisma.flight.findFirst({
    where: {
      hex,
      startTime: {
        gte: new Date(startTime.getTime() - tolerance),
        lte: new Date(startTime.getTime() + tolerance),
      },
    },
    select: { id: true },
  });
  return existing !== null;
}

async function segmentFlightsForHex(hex: string, cutoff: Date): Promise<number> {
  // Get all positions for this hex since cutoff
  const positions = await prisma.aircraftPosition.findMany({
    where: {
      hex,
      timestamp: { gte: cutoff },
    },
    orderBy: { timestamp: "asc" },
    select: {
      lat: true,
      lon: true,
      altitude: true,
      heading: true,
      speed: true,
      flight: true,
      timestamp: true,
    },
  });

  if (positions.length < 2) {
    return 0;
  }

  // Segment into flights
  const segments = segmentFlights(positions);
  let created = 0;

  for (const segment of segments) {
    const startTime = segment[0].timestamp;
    const endTime = segment[segment.length - 1].timestamp;

    // Check for duplicates
    if (await flightExists(hex, startTime)) {
      continue;
    }

    // Compute statistics
    const stats = computeFlightStats(segment);

    // Downsample positions
    const compactPositions = downsamplePositions(segment);

    // Create flight record
    await prisma.flight.create({
      data: {
        hex,
        callsign: stats.callsign,
        startTime,
        endTime,
        maxAltitude: stats.maxAltitude,
        totalDistance: Math.round(stats.totalDistance * 10) / 10, // Round to 1 decimal
        durationSecs: stats.durationSecs,
        positionCount: compactPositions.length,
        startLat: segment[0].lat,
        startLon: segment[0].lon,
        endLat: segment[segment.length - 1].lat,
        endLon: segment[segment.length - 1].lon,
        positions: compactPositions as unknown as Prisma.JsonArray,
      },
    });

    created++;
  }

  return created;
}

async function runSegmentation() {
  const cutoff = new Date(Date.now() - LOOKBACK_MINUTES * 60 * 1000);
  console.log(`[${new Date().toISOString()}] Flight segmenter running`);
  console.log(`Looking back ${LOOKBACK_MINUTES} minutes (since ${cutoff.toISOString()})`);
  console.log(`Gap threshold: ${GAP_THRESHOLD_MS / 60000} minutes`);

  // Get distinct hex values with recent positions
  const distinctHexes = await prisma.aircraftPosition.findMany({
    where: { timestamp: { gte: cutoff } },
    select: { hex: true },
    distinct: ["hex"],
  });

  console.log(`Found ${distinctHexes.length} aircraft with recent positions`);

  let totalCreated = 0;
  let processed = 0;

  for (const { hex } of distinctHexes) {
    const created = await segmentFlightsForHex(hex, cutoff);
    totalCreated += created;
    processed++;

    if (created > 0) {
      console.log(`  ${hex}: created ${created} flight(s)`);
    }

    // Progress update every 100 aircraft
    if (processed % 100 === 0) {
      console.log(`  Progress: ${processed}/${distinctHexes.length}`);
    }
  }

  console.log(`Completed: ${totalCreated} new flight records created`);
}

async function main() {
  console.log("Flight Segmenter starting...");
  console.log(`Mode: ${LOOP_MODE ? "continuous loop" : "single run"}`);

  if (LOOP_MODE) {
    console.log(`Interval: ${INTERVAL_MS / 1000}s`);

    // Initial run
    await runSegmentation();

    // Continuous loop
    setInterval(async () => {
      try {
        await runSegmentation();
      } catch (error) {
        console.error("Segmentation error:", error);
      }
    }, INTERVAL_MS);
  } else {
    // Single run mode (for PM2 cron)
    await runSegmentation();
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
  console.error("Flight segmenter failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
