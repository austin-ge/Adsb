import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { timingSafeEqual } from "crypto";

const READSB_JSON_URL =
  process.env.READSB_JSON_URL || "http://localhost:8080/data/aircraft.json";

const HEX_REGEX = /^[0-9a-f]{6}$/i;

// POST /api/internal/history-snapshot
// Called every 10 seconds by a cron/scheduler to save aircraft positions.
// Protected by INTERNAL_CRON_SECRET header.
export async function POST(request: NextRequest) {
  const internalSecret = process.env.INTERNAL_CRON_SECRET || "";

  // In production, the secret MUST be configured
  if (!internalSecret) {
    if (process.env.NODE_ENV === "production") {
      console.error("INTERNAL_CRON_SECRET is not configured in production");
      return NextResponse.json(
        { error: "Server misconfiguration" },
        { status: 500 }
      );
    }
    console.warn(
      "INTERNAL_CRON_SECRET is not set - skipping auth in development mode"
    );
  } else {
    const authHeader = request.headers.get("authorization") || "";
    const expected = `Bearer ${internalSecret}`;

    // Use timing-safe comparison to prevent timing attacks
    const authBuffer = Buffer.from(authHeader);
    const expectedBuffer = Buffer.from(expected);

    if (
      authBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(authBuffer, expectedBuffer)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const response = await fetch(READSB_JSON_URL, { cache: "no-store" });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to fetch aircraft data" },
        { status: 503 }
      );
    }

    const data = await response.json();
    const now = new Date();

    // Filter aircraft with valid positions and hex codes, then build records
    const records = data.aircraft
      .filter(
        (a: { hex?: string; lat?: number; lon?: number }) =>
          a.hex !== undefined &&
          HEX_REGEX.test(a.hex) &&
          a.lat !== undefined &&
          a.lon !== undefined &&
          typeof a.lat === "number" &&
          typeof a.lon === "number" &&
          a.lat >= -90 &&
          a.lat <= 90 &&
          a.lon >= -180 &&
          a.lon <= 180
      )
      .map(
        (a: {
          hex: string;
          flight?: string;
          alt_baro?: number | string;
          gs?: number;
          track?: number;
          squawk?: string;
          lat: number;
          lon: number;
        }) => ({
          hex: a.hex,
          lat: a.lat,
          lon: a.lon,
          altitude: typeof a.alt_baro === "number" ? a.alt_baro : null,
          heading: a.track ?? null,
          speed: a.gs ?? null,
          squawk: a.squawk || null,
          flight: a.flight?.trim() || null,
          timestamp: now,
        })
      );

    if (records.length > 0) {
      await prisma.aircraftPosition.createMany({ data: records });
    }

    return NextResponse.json({
      success: true,
      recorded: records.length,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("History snapshot error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

