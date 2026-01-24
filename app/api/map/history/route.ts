import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/api/rate-limit";

// Maximum time range: 1 hour
const MAX_RANGE_MS = 60 * 60 * 1000;

// GET /api/map/history?from=<iso>&to=<iso>
// Internal endpoint for the map playback UI. Returns positions grouped by snapshot timestamp.
export async function GET(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const clientIp =
    forwardedFor?.split(",")[0]?.trim() || realIp || "anonymous";
  const rateLimit = checkRateLimit(`map-history:${clientIp}`, 20);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  if (!fromParam || !toParam) {
    return NextResponse.json(
      { error: "Missing required parameters: from, to" },
      { status: 400 }
    );
  }

  const from = new Date(fromParam);
  const to = new Date(toParam);

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json(
      { error: "Invalid date format" },
      { status: 400 }
    );
  }

  if (from.getTime() >= to.getTime()) {
    return NextResponse.json(
      { error: "'from' must be before 'to'" },
      { status: 400 }
    );
  }

  if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
    return NextResponse.json(
      { error: "Time range too large (max 60 minutes)" },
      { status: 400 }
    );
  }

  try {
    const positions = await prisma.aircraftPosition.findMany({
      where: {
        timestamp: { gte: from, lte: to },
      },
      orderBy: { timestamp: "asc" },
      take: 100000,
      select: {
        hex: true,
        lat: true,
        lon: true,
        altitude: true,
        heading: true,
        speed: true,
        squawk: true,
        flight: true,
        timestamp: true,
      },
    });

    // Group by timestamp
    const snapshotMap: Map<
      number,
      Array<{
        hex: string;
        lat: number;
        lon: number;
        altitude: number | null;
        heading: number | null;
        speed: number | null;
        squawk: string | null;
        flight: string | null;
      }>
    > = new Map();

    for (const pos of positions) {
      const ts = pos.timestamp.getTime();
      const existing = snapshotMap.get(ts) || [];
      existing.push({
        hex: pos.hex,
        lat: pos.lat,
        lon: pos.lon,
        altitude: pos.altitude,
        heading: pos.heading,
        speed: pos.speed,
        squawk: pos.squawk,
        flight: pos.flight,
      });
      snapshotMap.set(ts, existing);
    }

    // Convert to sorted array of snapshots
    const timestamps = Array.from(snapshotMap.keys()).sort((a, b) => a - b);
    const snapshots = timestamps.map((ts) => ({
      timestamp: ts,
      aircraft: snapshotMap.get(ts)!,
    }));

    return NextResponse.json({
      from: from.toISOString(),
      to: to.toISOString(),
      snapshotCount: snapshots.length,
      totalPositions: positions.length,
      snapshots,
    });
  } catch (error) {
    console.error("Map history error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
