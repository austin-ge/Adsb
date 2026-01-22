import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-server";
import { randomUUID } from "crypto";

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

    // Generate unique UUID for the feeder
    const uuid = randomUUID();

    const feeder = await prisma.feeder.create({
      data: {
        uuid,
        name: name.trim(),
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
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
