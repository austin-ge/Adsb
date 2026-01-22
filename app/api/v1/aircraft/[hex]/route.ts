import { NextRequest, NextResponse } from "next/server";
import { validateApiRequest } from "@/lib/api/middleware";
import { fetchAircraftData } from "@/lib/readsb";

interface RouteParams {
  params: Promise<{ hex: string }>;
}

// GET /api/v1/aircraft/[hex] - Get single aircraft by ICAO hex
export async function GET(request: NextRequest, { params }: RouteParams) {
  // Validate API request and check rate limits
  const validation = await validateApiRequest(request);
  if (validation?.response) {
    return validation.response;
  }

  const { hex } = await params;
  const hexUpper = hex.toUpperCase();

  try {
    const data = await fetchAircraftData();

    if (!data) {
      return NextResponse.json(
        { error: "Unable to fetch aircraft data" },
        { status: 503 }
      );
    }

    const aircraft = data.aircraft.find(
      (a) => a.hex.toUpperCase() === hexUpper
    );

    if (!aircraft) {
      return NextResponse.json(
        { error: "Aircraft not found", hex: hexUpper },
        { status: 404 }
      );
    }

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
        hex: aircraft.hex,
        flight: aircraft.flight?.trim() || null,
        registration: aircraft.r || null,
        type: aircraft.t || null,
        lat: aircraft.lat ?? null,
        lon: aircraft.lon ?? null,
        altitude: aircraft.alt_baro ?? null,
        altitude_geom: aircraft.alt_geom ?? null,
        ground_speed: aircraft.gs ?? null,
        track: aircraft.track ?? null,
        vertical_rate: aircraft.baro_rate ?? null,
        squawk: aircraft.squawk || null,
        category: aircraft.category || null,
        seen: aircraft.seen ?? null,
        seen_pos: aircraft.seen_pos ?? null,
        rssi: aircraft.rssi ?? null,
        messages: aircraft.messages ?? null,
      },
      { headers }
    );
  } catch (error) {
    console.error("Error fetching aircraft:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
