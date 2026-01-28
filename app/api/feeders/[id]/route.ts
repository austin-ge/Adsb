import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/feeders/[id] - Get a single feeder
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const feeder = await prisma.feeder.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        stats: {
          orderBy: { timestamp: "desc" },
          take: 168, // Last 7 days of hourly stats (168 hours)
          select: {
            id: true,
            timestamp: true,
            messages: true,
            positions: true,
            aircraft: true,
            maxRange: true,
            avgRange: true,
            uptimePercent: true,
          },
        },
      },
    });

    if (!feeder) {
      return NextResponse.json({ error: "Feeder not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...feeder,
      messagesTotal: feeder.messagesTotal.toString(),
      positionsTotal: feeder.positionsTotal.toString(),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching feeder:", error);
    return NextResponse.json(
      { error: "Failed to fetch feeder" },
      { status: 500 }
    );
  }
}

// PATCH /api/feeders/[id] - Update a feeder
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    // Verify ownership
    const existingFeeder = await prisma.feeder.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existingFeeder) {
      return NextResponse.json({ error: "Feeder not found" }, { status: 404 });
    }

    const { name, latitude, longitude } = body;

    const updateData: {
      name?: string;
      latitude?: number | null;
      longitude?: number | null;
    } = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { error: "Name cannot be empty" },
          { status: 400 }
        );
      }
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
      updateData.name = trimmedName;
    }

    if (latitude !== undefined) {
      if (latitude === null) {
        updateData.latitude = null;
      } else {
        const lat = parseFloat(latitude);
        if (isNaN(lat) || lat < -90 || lat > 90) {
          return NextResponse.json(
            { error: "Latitude must be between -90 and 90" },
            { status: 400 }
          );
        }
        updateData.latitude = lat;
      }
    }

    if (longitude !== undefined) {
      if (longitude === null) {
        updateData.longitude = null;
      } else {
        const lng = parseFloat(longitude);
        if (isNaN(lng) || lng < -180 || lng > 180) {
          return NextResponse.json(
            { error: "Longitude must be between -180 and 180" },
            { status: 400 }
          );
        }
        updateData.longitude = lng;
      }
    }

    const feeder = await prisma.feeder.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      id: feeder.id,
      uuid: feeder.uuid,
      name: feeder.name,
      latitude: feeder.latitude,
      longitude: feeder.longitude,
      updatedAt: feeder.updatedAt,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error updating feeder:", error);
    return NextResponse.json(
      { error: "Failed to update feeder" },
      { status: 500 }
    );
  }
}

// DELETE /api/feeders/[id] - Delete a feeder
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    // Verify ownership
    const existingFeeder = await prisma.feeder.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existingFeeder) {
      return NextResponse.json({ error: "Feeder not found" }, { status: 404 });
    }

    await prisma.feeder.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error deleting feeder:", error);
    return NextResponse.json(
      { error: "Failed to delete feeder" },
      { status: 500 }
    );
  }
}
