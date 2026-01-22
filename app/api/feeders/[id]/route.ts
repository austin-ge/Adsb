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
          take: 24, // Last 24 hours of stats
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
      updateData.name = name.trim();
    }

    if (latitude !== undefined) {
      updateData.latitude = latitude ? parseFloat(latitude) : null;
    }

    if (longitude !== undefined) {
      updateData.longitude = longitude ? parseFloat(longitude) : null;
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
