import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/feeders/[id]/flights - Get recent flights for a feeder
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    // Verify ownership - user must own the feeder
    const feeder = await prisma.feeder.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      select: { id: true },
    });

    if (!feeder) {
      return NextResponse.json({ error: "Feeder not found" }, { status: 404 });
    }

    // Since we don't track which feeder saw which flight,
    // return the most recent flights from the Flight table
    const flights = await prisma.flight.findMany({
      orderBy: { endTime: "desc" },
      take: 20,
      select: {
        id: true,
        hex: true,
        callsign: true,
        startTime: true,
        endTime: true,
        maxAltitude: true,
        totalDistance: true,
        durationSecs: true,
      },
    });

    return NextResponse.json({ flights });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching feeder flights:", error);
    return NextResponse.json(
      { error: "Failed to fetch flights" },
      { status: 500 }
    );
  }
}
