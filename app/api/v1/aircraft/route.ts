import { NextRequest, NextResponse } from "next/server";
import { validateApiRequest } from "@/lib/api/middleware";
import { fetchAircraftData } from "@/lib/readsb";
import { captureException } from "@/lib/sentry";

// GET /api/v1/aircraft - Get live aircraft data
export async function GET(request: NextRequest) {
  // Validate API request and check rate limits
  const validation = await validateApiRequest(request);
  if (validation?.response) {
    return validation.response;
  }

  const { searchParams } = new URL(request.url);

  // Optional filters
  const bounds = searchParams.get("bounds"); // lat1,lon1,lat2,lon2
  const minAlt = searchParams.get("min_alt");
  const maxAlt = searchParams.get("max_alt");
  const flight = searchParams.get("flight"); // Filter by callsign
  const limit = Math.min(parseInt(searchParams.get("limit") || "1000"), 5000);

  try {
    const data = await fetchAircraftData();

    if (!data) {
      return NextResponse.json(
        { error: "Unable to fetch aircraft data" },
        { status: 503 }
      );
    }

    let aircraft = data.aircraft;

    // Apply bounds filter
    if (bounds) {
      const [lat1, lon1, lat2, lon2] = bounds.split(",").map(Number);
      if (!isNaN(lat1) && !isNaN(lon1) && !isNaN(lat2) && !isNaN(lon2)) {
        const minLat = Math.min(lat1, lat2);
        const maxLat = Math.max(lat1, lat2);
        const minLon = Math.min(lon1, lon2);
        const maxLon = Math.max(lon1, lon2);

        aircraft = aircraft.filter(
          (a) =>
            a.lat !== undefined &&
            a.lon !== undefined &&
            a.lat >= minLat &&
            a.lat <= maxLat &&
            a.lon >= minLon &&
            a.lon <= maxLon
        );
      }
    }

    // Apply altitude filters
    if (minAlt) {
      const min = parseInt(minAlt);
      if (!isNaN(min)) {
        aircraft = aircraft.filter(
          (a) => a.alt_baro !== undefined && a.alt_baro >= min
        );
      }
    }

    if (maxAlt) {
      const max = parseInt(maxAlt);
      if (!isNaN(max)) {
        aircraft = aircraft.filter(
          (a) => a.alt_baro !== undefined && a.alt_baro <= max
        );
      }
    }

    // Apply callsign filter
    if (flight) {
      const flightUpper = flight.toUpperCase();
      aircraft = aircraft.filter(
        (a) => a.flight?.trim().toUpperCase().includes(flightUpper)
      );
    }

    // Apply limit
    aircraft = aircraft.slice(0, limit);

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
        now: data.now,
        total: data.aircraft.length,
        filtered: aircraft.length,
        aircraft: aircraft.map((a) => ({
          hex: a.hex,
          flight: a.flight?.trim() || null,
          registration: a.r || null,
          type: a.t || null,
          lat: a.lat ?? null,
          lon: a.lon ?? null,
          altitude: a.alt_baro ?? null,
          altitude_geom: a.alt_geom ?? null,
          ground_speed: a.gs ?? null,
          track: a.track ?? null,
          vertical_rate: a.baro_rate ?? null,
          squawk: a.squawk || null,
          category: a.category || null,
          seen: a.seen ?? null,
          seen_pos: a.seen_pos ?? null,
          rssi: a.rssi ?? null,
        })),
      },
      { headers }
    );
  } catch (error) {
    console.error("Error fetching aircraft:", error);
    captureException(error, {
      tags: { "api.endpoint": "v1.aircraft" },
      extra: { bounds, minAlt, maxAlt, flight, limit },
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
