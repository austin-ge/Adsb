import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Health check endpoint for monitoring database connectivity.
 *
 * GET /api/health
 *
 * Returns:
 * - 200: { status: "ok", db: "connected" }
 * - 500: { status: "error", db: "disconnected", error: string }
 */
export async function GET() {
  try {
    // Execute a simple query to verify database connectivity
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "ok",
      db: "connected",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown database error";

    return NextResponse.json(
      {
        status: "error",
        db: "disconnected",
        error: message,
      },
      { status: 500 }
    );
  }
}
