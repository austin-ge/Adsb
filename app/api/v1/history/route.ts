import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiRequest } from "@/lib/api/middleware";
import { captureException } from "@/lib/sentry";

// Maximum time range allowed per request (1 hour)
const MAX_RANGE_MS = 60 * 60 * 1000;
// Maximum records returned per request
const MAX_RESULTS = 50000;
// Valid ICAO hex code pattern
const HEX_REGEX = /^[0-9a-f]{6}$/i;

// GET /api/v1/history?from=<iso>&to=<iso>&hex=<optional>
// Returns historical aircraft positions for the given time range.
export async function GET(request: NextRequest) {
  // Validate API key and check rate limits
  const validation = await validateApiRequest(request);
  if (validation?.response) {
    return validation.response;
  }

  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const hexParam = searchParams.get("hex");

  if (!fromParam || !toParam) {
    return NextResponse.json(
      { error: "Missing required parameters: from, to (ISO 8601 timestamps)" },
      { status: 400 }
    );
  }

  const from = new Date(fromParam);
  const to = new Date(toParam);

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json(
      { error: "Invalid date format. Use ISO 8601 (e.g., 2026-01-24T12:00:00Z)" },
      { status: 400 }
    );
  }

  if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
    return NextResponse.json(
      { error: `Time range too large. Maximum allowed: ${MAX_RANGE_MS / 60000} minutes` },
      { status: 400 }
    );
  }

  if (from >= to) {
    return NextResponse.json(
      { error: "'from' must be before 'to'" },
      { status: 400 }
    );
  }

  try {
    const where: {
      timestamp: { gte: Date; lte: Date };
      hex?: string;
    } = {
      timestamp: { gte: from, lte: to },
    };

    if (hexParam) {
      if (!HEX_REGEX.test(hexParam)) {
        return NextResponse.json(
          { error: "Invalid hex parameter. Must be a 6-character ICAO hex code (e.g., a1b2c3)" },
          { status: 400 }
        );
      }
      where.hex = hexParam.toLowerCase();
    }

    const positions = await prisma.aircraftPosition.findMany({
      where,
      orderBy: { timestamp: "asc" },
      take: MAX_RESULTS,
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

    // Group positions by timestamp for efficient client-side playback
    const snapshots: Map<string, typeof positions> = new Map();
    for (const pos of positions) {
      const tsKey = pos.timestamp.toISOString();
      const existing = snapshots.get(tsKey) || [];
      existing.push(pos);
      snapshots.set(tsKey, existing);
    }

    const result = Array.from(snapshots.entries()).map(([ts, aircraft]) => ({
      timestamp: ts,
      aircraft: aircraft.map((a) => ({
        hex: a.hex,
        lat: a.lat,
        lon: a.lon,
        altitude: a.altitude,
        heading: a.heading,
        speed: a.speed,
        squawk: a.squawk,
        flight: a.flight,
      })),
    }));

    // Build response with rate limit headers
    const headers = new Headers();
    if (validation?.context.rateLimit) {
      headers.set(
        "X-RateLimit-Limit",
        String(validation.context.rateLimit.limit)
      );
      headers.set(
        "X-RateLimit-Remaining",
        String(validation.context.rateLimit.remaining)
      );
      headers.set(
        "X-RateLimit-Reset",
        String(validation.context.rateLimit.reset)
      );
    }

    return NextResponse.json(
      {
        from: from.toISOString(),
        to: to.toISOString(),
        snapshots: result.length,
        totalPositions: positions.length,
        data: result,
      },
      { headers }
    );
  } catch (error) {
    console.error("History API error:", error);
    captureException(error, {
      tags: { "api.endpoint": "v1.history" },
      extra: { from: fromParam, to: toParam, hex: hexParam },
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
