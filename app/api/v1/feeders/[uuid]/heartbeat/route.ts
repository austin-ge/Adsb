import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ uuid: string }>;
}

interface HeartbeatPayload {
  // From readsb stats.json
  now?: number;
  aircraft_count?: number;
  aircraft_with_pos?: number;
  messages?: number;
  positions?: number;
  // RSSI stats
  rssi?: number;
  rssi_min?: number;
  rssi_max?: number;
  // From aircraft.json
  aircraft?: Array<{
    hex: string;
    rssi?: number;
    [key: string]: unknown;
  }>;
  // Optional metadata
  version?: string;
  uptime?: number;
}

// POST /api/v1/feeders/:uuid/heartbeat
// Receives stats from a feeder and updates its record
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { uuid } = await params;

  // Validate UUID format
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(uuid)) {
    return NextResponse.json({ error: "Invalid UUID format" }, { status: 400 });
  }

  // Find the feeder
  const feeder = await prisma.feeder.findUnique({
    where: { uuid },
    include: { user: { select: { id: true, apiTier: true } } },
  });

  if (!feeder) {
    return NextResponse.json({ error: "Feeder not found" }, { status: 404 });
  }

  // Parse the payload
  let payload: HeartbeatPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  // Calculate stats from payload
  const aircraftCount = payload.aircraft_count ?? payload.aircraft?.length ?? 0;
  const aircraftWithPos = payload.aircraft_with_pos ?? 0;
  const messages = payload.messages ?? 0;
  const positions = payload.positions ?? 0;

  // Calculate RSSI if aircraft array provided
  let rssiAvg = payload.rssi;
  if (!rssiAvg && payload.aircraft && payload.aircraft.length > 0) {
    const rssiValues = payload.aircraft
      .map((a) => a.rssi)
      .filter((r): r is number => r !== undefined && r < 0);
    if (rssiValues.length > 0) {
      rssiAvg = rssiValues.reduce((a, b) => a + b, 0) / rssiValues.length;
    }
  }

  try {
    // Update feeder stats
    const updatedFeeder = await prisma.feeder.update({
      where: { id: feeder.id },
      data: {
        // Increment totals
        messagesTotal: {
          increment: messages > 0 ? BigInt(messages) : BigInt(0),
        },
        positionsTotal: {
          increment: positions > 0 ? BigInt(positions) : BigInt(0),
        },
        // Update current stats
        aircraftSeen: Math.max(feeder.aircraftSeen, aircraftCount),
        lastSeen: new Date(),
        isOnline: true,
      },
    });

    // Auto-upgrade user to FEEDER tier if currently FREE
    if (feeder.user.apiTier === "FREE") {
      await prisma.user.update({
        where: { id: feeder.user.id },
        data: { apiTier: "FEEDER" },
      });
    }

    return NextResponse.json({
      success: true,
      feeder: {
        uuid: updatedFeeder.uuid,
        name: updatedFeeder.name,
        isOnline: updatedFeeder.isOnline,
        messagesTotal: updatedFeeder.messagesTotal.toString(),
        positionsTotal: updatedFeeder.positionsTotal.toString(),
        aircraftSeen: updatedFeeder.aircraftSeen,
      },
    });
  } catch (error) {
    console.error("Error updating feeder:", error);
    return NextResponse.json(
      { error: "Failed to update feeder stats" },
      { status: 500 }
    );
  }
}

// GET /api/v1/feeders/:uuid/heartbeat
// Returns current feeder status (useful for debugging)
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { uuid } = await params;

  const feeder = await prisma.feeder.findUnique({
    where: { uuid },
    select: {
      uuid: true,
      name: true,
      isOnline: true,
      lastSeen: true,
      messagesTotal: true,
      positionsTotal: true,
      aircraftSeen: true,
    },
  });

  if (!feeder) {
    return NextResponse.json({ error: "Feeder not found" }, { status: 404 });
  }

  return NextResponse.json({
    uuid: feeder.uuid,
    name: feeder.name,
    isOnline: feeder.isOnline,
    lastSeen: feeder.lastSeen,
    messagesTotal: feeder.messagesTotal.toString(),
    positionsTotal: feeder.positionsTotal.toString(),
    aircraftSeen: feeder.aircraftSeen,
  });
}
