import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiRequest } from "@/lib/api/middleware";

// GET /api/v1/flights/:id/track
// Returns flight details with full position track
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Validate API key and check rate limits
  const validation = await validateApiRequest(request);
  if (validation?.response) {
    return validation.response;
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
      },
      { headers }
    );
  } catch (error) {
    console.error("Flight track API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
