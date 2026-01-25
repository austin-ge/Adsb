import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiRequest } from "@/lib/api/middleware";

// Valid ICAO hex code pattern (6 hex chars)
const HEX_REGEX = /^[0-9a-f]{6}$/i;
// Max results per request
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

interface FlightRecord {
  id: string;
  hex: string;
  callsign: string | null;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  maxAltitude: number | null;
  positionCount: number;
}

interface FlightSearchResult {
  hex: string;
  callsigns: string[];
  flightCount: number;
  lastSeen: string;
}

// GET /api/v1/flights?q=UAL123&from=2026-01-20&to=2026-01-24&limit=50
// Search flights by callsign (case-insensitive contains) or hex (exact if 6 chars)
export async function GET(request: NextRequest) {
  // Validate API key and check rate limits
  const validation = await validateApiRequest(request);
  if (validation?.response) {
    return validation.response;
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const limitParam = searchParams.get("limit");

  // Parse limit
  let limit = DEFAULT_LIMIT;
  if (limitParam) {
    const parsed = parseInt(limitParam);
    if (!isNaN(parsed) && parsed > 0) {
      limit = Math.min(parsed, MAX_LIMIT);
    }
  }

  // Build where clause
  const where: {
    startTime?: { gte?: Date; lte?: Date };
    OR?: Array<{ hex?: string; callsign?: { contains: string; mode: "insensitive" } }>;
    hex?: string;
    callsign?: { contains: string; mode: "insensitive" };
  } = {};

  // Date range filtering
  if (fromParam) {
    const from = new Date(fromParam);
    if (isNaN(from.getTime())) {
      return NextResponse.json(
        { error: "Invalid 'from' date format. Use ISO 8601 or YYYY-MM-DD" },
        { status: 400 }
      );
    }
    where.startTime = { ...where.startTime, gte: from };
  }

  if (toParam) {
    const to = new Date(toParam);
    if (isNaN(to.getTime())) {
      return NextResponse.json(
        { error: "Invalid 'to' date format. Use ISO 8601 or YYYY-MM-DD" },
        { status: 400 }
      );
    }
    // If only date provided (no time), set to end of day
    if (toParam.length === 10) {
      to.setHours(23, 59, 59, 999);
    }
    where.startTime = { ...where.startTime, lte: to };
  }

  // Query filtering: hex (exact) or callsign (contains, case-insensitive)
  if (query) {
    if (HEX_REGEX.test(query)) {
      // Exact hex match
      where.hex = query.toLowerCase();
    } else {
      // Callsign search (case-insensitive contains)
      where.callsign = { contains: query, mode: "insensitive" };
    }
  }

  try {
    // Fetch flights matching criteria
    const flights = await prisma.flight.findMany({
      where,
      orderBy: { startTime: "desc" },
      take: limit,
      select: {
        id: true,
        hex: true,
        callsign: true,
        startTime: true,
        endTime: true,
        durationSecs: true,
        maxAltitude: true,
        totalDistance: true,
        positionCount: true,
        startLat: true,
        startLon: true,
        endLat: true,
        endLon: true,
      },
    });

    // Group flights by aircraft (hex) - separate results and flights for UI
    const resultsMap = new Map<string, FlightSearchResult>();
    const flightsMap: Record<string, FlightRecord[]> = {};

    for (const flight of flights) {
      const existing = resultsMap.get(flight.hex);

      const flightRecord: FlightRecord = {
        id: flight.id,
        hex: flight.hex,
        callsign: flight.callsign,
        startTime: flight.startTime.toISOString(),
        endTime: flight.endTime.toISOString(),
        durationMinutes: Math.round(flight.durationSecs / 60),
        maxAltitude: flight.maxAltitude,
        positionCount: flight.positionCount,
      };

      // Add to flights map
      if (!flightsMap[flight.hex]) {
        flightsMap[flight.hex] = [];
      }
      flightsMap[flight.hex].push(flightRecord);

      if (existing) {
        existing.flightCount++;
        if (flight.callsign && !existing.callsigns.includes(flight.callsign)) {
          existing.callsigns.push(flight.callsign);
        }
        // Update lastSeen if this flight is more recent
        if (flight.endTime.toISOString() > existing.lastSeen) {
          existing.lastSeen = flight.endTime.toISOString();
        }
      } else {
        resultsMap.set(flight.hex, {
          hex: flight.hex,
          callsigns: flight.callsign ? [flight.callsign] : [],
          flightCount: 1,
          lastSeen: flight.endTime.toISOString(),
        });
      }
    }

    const results = Array.from(resultsMap.values());

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
        results,
        flights: flightsMap,
        total: results.length,
      },
      { headers }
    );
  } catch (error) {
    console.error("Flights search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
