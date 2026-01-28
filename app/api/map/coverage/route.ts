import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/api/rate-limit";

// Grid size for spatial aggregation (in degrees)
// ~0.1 degrees = ~11km at equator, good balance of detail vs performance
const GRID_SIZE = 0.1;

// Default time range: last 24 hours
const DEFAULT_HOURS = 24;

// Maximum time range: 7 days
const MAX_HOURS = 168;

// Maximum points to return (limit for client performance)
const MAX_POINTS = 10000;

interface CoveragePoint {
  lat: number;
  lon: number;
  count: number;
}

// GET /api/map/coverage?hours=24
// Returns aggregated position density for receiver coverage heatmap
export async function GET(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const clientIp =
    forwardedFor?.split(",")[0]?.trim() || realIp || "anonymous";

  // Rate limit: 10 requests per minute (coverage data doesn't need frequent updates)
  const rateLimit = await checkRateLimit(`map-coverage:${clientIp}`, 10);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const hoursParam = searchParams.get("hours");

  let hours = DEFAULT_HOURS;
  if (hoursParam) {
    const parsed = parseInt(hoursParam, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= MAX_HOURS) {
      hours = parsed;
    }
  }

  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  try {
    // Use raw SQL for efficient spatial aggregation
    // Group positions into grid cells and count occurrences
    const result = await prisma.$queryRaw<
      Array<{ grid_lat: number; grid_lon: number; position_count: bigint }>
    >`
      SELECT
        ROUND(lat / ${GRID_SIZE}) * ${GRID_SIZE} as grid_lat,
        ROUND(lon / ${GRID_SIZE}) * ${GRID_SIZE} as grid_lon,
        COUNT(*) as position_count
      FROM "AircraftPosition"
      WHERE timestamp >= ${since}
      GROUP BY grid_lat, grid_lon
      ORDER BY position_count DESC
      LIMIT ${MAX_POINTS}
    `;

    // Convert to GeoJSON format for Mapbox heatmap
    const points: CoveragePoint[] = result.map((row) => ({
      lat: Number(row.grid_lat),
      lon: Number(row.grid_lon),
      count: Number(row.position_count),
    }));

    // Find max count for normalization hint
    const maxCount = points.length > 0 ? Math.max(...points.map((p) => p.count)) : 0;

    return NextResponse.json({
      hours,
      since: since.toISOString(),
      pointCount: points.length,
      maxCount,
      gridSize: GRID_SIZE,
      points,
    });
  } catch (error) {
    console.error("Coverage API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
