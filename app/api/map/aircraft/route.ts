import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/api/rate-limit";

const READSB_JSON_URL =
  process.env.READSB_JSON_URL || "http://localhost:8080/data/aircraft.json";

// GET /api/map/aircraft - Internal endpoint for map (no auth required)
export async function GET(request: NextRequest) {
  // Rate limit: 60 requests per minute per IP (map polls every ~1s)
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const clientIp = forwardedFor?.split(",")[0]?.trim() || realIp || "anonymous";
  const rateLimit = checkRateLimit(`map:${clientIp}`, 60);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }
  try {
    const response = await fetch(READSB_JSON_URL, {
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to fetch aircraft data" },
        { status: 503 }
      );
    }

    const data = await response.json();

    // Filter to only aircraft with positions
    const aircraft = data.aircraft
      .filter(
        (a: { lat?: number; lon?: number }) =>
          a.lat !== undefined && a.lon !== undefined
      )
      .map(
        (a: {
          hex: string;
          flight?: string;
          r?: string;
          t?: string;
          alt_baro?: number | string;
          alt_geom?: number;
          gs?: number;
          track?: number;
          baro_rate?: number;
          squawk?: string;
          category?: string;
          seen?: number;
          seen_pos?: number;
          rssi?: number;
          lat?: number;
          lon?: number;
        }) => ({
          hex: a.hex,
          flight: a.flight?.trim() || null,
          registration: a.r || null,
          type: a.t || null,
          lat: a.lat,
          lon: a.lon,
          altitude: typeof a.alt_baro === "number" ? a.alt_baro : null,
          ground_speed: a.gs ?? null,
          track: a.track ?? null,
          vertical_rate: a.baro_rate ?? null,
          squawk: a.squawk || null,
          category: a.category || null,
          seen: a.seen ?? null,
        })
      );

    return NextResponse.json({
      now: data.now,
      total: aircraft.length,
      aircraft,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
