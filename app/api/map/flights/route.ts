import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

// GET /api/map/flights?q=UAL123&limit=50
// Internal flight search for map UI (no API key required)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const limitParam = searchParams.get("limit");

  // Require at least 2 characters
  if (!query || query.length < 2) {
    return NextResponse.json({ results: [], flights: {}, total: 0 });
  }

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
    hex?: string;
    callsign?: { contains: string; mode: "insensitive" };
  } = {};

  if (HEX_REGEX.test(query)) {
    // Exact hex match
    where.hex = query.toLowerCase();
  } else {
    // Callsign search (case-insensitive contains)
    where.callsign = { contains: query, mode: "insensitive" };
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
        positionCount: true,
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

    return NextResponse.json({
      results,
      flights: flightsMap,
      total: results.length,
    });
  } catch (error) {
    console.error("Flights search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
