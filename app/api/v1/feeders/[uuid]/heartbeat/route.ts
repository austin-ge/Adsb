import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/api/rate-limit";

interface RouteParams {
  params: Promise<{ uuid: string }>;
}

// Allowed software types for validation
const ALLOWED_SOFTWARE_TYPES = [
  "ultrafeeder",
  "piaware",
  "fr24",
  "readsb",
  "dump1090-fa",
  "dump1090-mutability",
] as const;

type SoftwareType = (typeof ALLOWED_SOFTWARE_TYPES)[number];

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
  softwareType?: string;
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

  // Rate limit: 10 heartbeats per minute per UUID
  const rateLimit = checkRateLimit(`heartbeat:${uuid}`, 10);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded", reset: new Date(rateLimit.reset).toISOString() },
      { status: 429 }
    );
  }

  // Validate heartbeat token from Authorization header
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid Authorization header" },
      { status: 401 }
    );
  }
  const token = authHeader.slice(7);

  // Find the feeder
  const feeder = await prisma.feeder.findUnique({
    where: { uuid },
    include: { user: { select: { id: true, apiTier: true } } },
  });

  if (!feeder) {
    return NextResponse.json({ error: "Feeder not found" }, { status: 404 });
  }

  // Verify heartbeat token using timing-safe comparison
  const { timingSafeEqual } = await import("crypto");
  const tokenBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(feeder.heartbeatToken);
  if (
    tokenBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(tokenBuffer, expectedBuffer)
  ) {
    return NextResponse.json(
      { error: "Invalid heartbeat token" },
      { status: 403 }
    );
  }

  // Parse the payload
  let payload: HeartbeatPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  // Calculate stats from payload with bounds checking
  const aircraftCount = Math.max(0, Math.min(10000, payload.aircraft_count ?? payload.aircraft?.length ?? 0));
  const _aircraftWithPos = Math.max(0, Math.min(10000, payload.aircraft_with_pos ?? 0));
  const messages = Math.max(0, Math.min(1000000, payload.messages ?? 0));
  const positions = Math.max(0, Math.min(1000000, payload.positions ?? 0));

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

  // Validate and extract softwareType (only accept allowed values)
  let validatedSoftwareType: SoftwareType | undefined;
  if (
    payload.softwareType &&
    ALLOWED_SOFTWARE_TYPES.includes(payload.softwareType as SoftwareType)
  ) {
    validatedSoftwareType = payload.softwareType as SoftwareType;
  }

  try {
    // Determine if we should update softwareType (first heartbeat wins)
    const shouldUpdateSoftwareType =
      validatedSoftwareType && !feeder.softwareType;

    // Update feeder stats and auto-upgrade user tier in parallel
    const [updatedFeeder] = await Promise.all([
      prisma.feeder.update({
        where: { id: feeder.id },
        data: {
          messagesTotal: {
            increment: messages > 0 ? BigInt(messages) : BigInt(0),
          },
          positionsTotal: {
            increment: positions > 0 ? BigInt(positions) : BigInt(0),
          },
          aircraftSeen: Math.max(feeder.aircraftSeen, aircraftCount),
          lastSeen: new Date(),
          isOnline: true,
          ...(shouldUpdateSoftwareType && {
            softwareType: validatedSoftwareType,
          }),
        },
      }),
      feeder.user.apiTier === "FREE"
        ? prisma.user.update({
            where: { id: feeder.user.id },
            data: { apiTier: "FEEDER" },
          })
        : Promise.resolve(null),
    ]);

    return NextResponse.json({
      success: true,
      feeder: {
        uuid: updatedFeeder.uuid,
        name: updatedFeeder.name,
        isOnline: updatedFeeder.isOnline,
        messagesTotal: updatedFeeder.messagesTotal.toString(),
        positionsTotal: updatedFeeder.positionsTotal.toString(),
        aircraftSeen: updatedFeeder.aircraftSeen,
        ...(updatedFeeder.softwareType && {
          softwareType: updatedFeeder.softwareType,
        }),
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
