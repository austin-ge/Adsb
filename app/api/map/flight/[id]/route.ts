import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/api/rate-limit";

// GET /api/map/flight/:id
// Internal endpoint for the map UI. Returns flight details with full position track.
// No API key required, but rate limited by IP.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limit by IP
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const clientIp =
    forwardedFor?.split(",")[0]?.trim() || realIp || "anonymous";
  const rateLimit = await checkRateLimit(`map-flight:${clientIp}`, 60);

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  const { id } = await params;

  // Validate ID format (cuid)
  if (!id || !/^[a-z0-9]{20,30}$/i.test(id)) {
    return NextResponse.json(
      { error: "Invalid flight ID format" },
      { status: 400 }
    );
  }

  try {
    const flight = await prisma.flight.findUnique({
      where: { id },
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
        positions: true,
      },
    });

    if (!flight) {
      return NextResponse.json(
        { error: "Flight not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: flight.id,
      hex: flight.hex,
      callsign: flight.callsign,
      startTime: flight.startTime.toISOString(),
      endTime: flight.endTime.toISOString(),
      durationSecs: flight.durationSecs,
      maxAltitude: flight.maxAltitude,
      totalDistance: flight.totalDistance,
      positionCount: flight.positionCount,
      startLat: flight.startLat,
      startLon: flight.startLon,
      endLat: flight.endLat,
      endLon: flight.endLon,
      positions: flight.positions,
    });
  } catch (error) {
    console.error("Map flight API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
