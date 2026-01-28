import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-server";
import { randomUUID, randomBytes } from "crypto";

// GET /api/feeders - List user's feeders
export async function GET() {
  try {
    const session = await requireAuth();

    const feeders = await prisma.feeder.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        uuid: true,
        name: true,
        latitude: true,
        longitude: true,
        messagesTotal: true,
        positionsTotal: true,
        aircraftSeen: true,
        lastSeen: true,
        isOnline: true,
        createdAt: true,
      },
    });

    // Convert BigInt to string for JSON serialization
    const serializedFeeders = feeders.map((feeder) => ({
      ...feeder,
      messagesTotal: feeder.messagesTotal.toString(),
      positionsTotal: feeder.positionsTotal.toString(),
    }));

    return NextResponse.json(serializedFeeders);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching feeders:", error);
    return NextResponse.json(
      { error: "Failed to fetch feeders" },
      { status: 500 }
    );
  }
}

// POST /api/feeders - Create a new feeder
export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const { name, latitude, longitude } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Validate name: only safe characters, max 64 chars
    const trimmedName = name.trim();
    if (trimmedName.length > 64) {
      return NextResponse.json(
        { error: "Name must be 64 characters or fewer" },
        { status: 400 }
      );
    }
    if (!/^[a-zA-Z0-9 _\-\.]+$/.test(trimmedName)) {
      return NextResponse.json(
        { error: "Name can only contain letters, numbers, spaces, hyphens, underscores, and dots" },
        { status: 400 }
      );
    }

    // Validate coordinates if provided
    if (latitude !== undefined && latitude !== null) {
      const lat = parseFloat(latitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        return NextResponse.json(
          { error: "Latitude must be between -90 and 90" },
          { status: 400 }
        );
      }
    }
    if (longitude !== undefined && longitude !== null) {
      const lng = parseFloat(longitude);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        return NextResponse.json(
          { error: "Longitude must be between -180 and 180" },
          { status: 400 }
        );
      }
    }

    // Generate unique UUID and enrollment token for the feeder
    // Note: heartbeatToken is NOT generated here - it's created during enrollment
    const uuid = randomUUID();
    const enrollmentToken = randomBytes(32).toString("hex");
    const enrollmentExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    const feeder = await prisma.feeder.create({
      data: {
        uuid,
        name: name.trim(),
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        enrollmentToken,
        enrollmentExpires,
        userId: session.user.id,
      },
    });

    return NextResponse.json({
      id: feeder.id,
      uuid: feeder.uuid,
      name: feeder.name,
      latitude: feeder.latitude,
      longitude: feeder.longitude,
      createdAt: feeder.createdAt,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error creating feeder:", error);
    return NextResponse.json(
      { error: "Failed to create feeder" },
      { status: 500 }
    );
  }
}
