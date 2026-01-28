import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-server";
import { randomBytes } from "crypto";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/feeders/[id]/regenerate-enrollment
// Regenerates the enrollment token for a feeder (for reinstallation)
// This also clears any existing heartbeat token, requiring re-enrollment
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    // Verify ownership
    const existingFeeder = await prisma.feeder.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      select: {
        id: true,
        uuid: true,
        name: true,
      },
    });

    if (!existingFeeder) {
      return NextResponse.json({ error: "Feeder not found" }, { status: 404 });
    }

    // Generate new enrollment token
    const enrollmentToken = randomBytes(32).toString("hex");
    const enrollmentExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Update feeder: set new enrollment token, clear heartbeat token
    const feeder = await prisma.feeder.update({
      where: { id },
      data: {
        enrollmentToken,
        enrollmentExpires,
        heartbeatToken: null, // Clear existing heartbeat token - requires re-enrollment
      },
    });

    return NextResponse.json({
      success: true,
      uuid: feeder.uuid,
      enrollmentExpires: enrollmentExpires.toISOString(),
      message: "Enrollment token regenerated. The install script is now valid for 1 hour.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error regenerating enrollment token:", error);
    return NextResponse.json(
      { error: "Failed to regenerate enrollment token" },
      { status: 500 }
    );
  }
}
