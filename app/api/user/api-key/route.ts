import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-server";
import { randomBytes } from "crypto";

// Generate a secure API key
function generateApiKey(): string {
  // Format: adsb_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx (32 random hex chars)
  const randomPart = randomBytes(16).toString("hex");
  return `adsb_live_${randomPart}`;
}

// GET /api/user/api-key - Get current API key (masked)
export async function GET() {
  try {
    const session = await requireAuth();

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { apiKey: true, apiTier: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Mask the API key for display (show first 12 and last 4 chars)
    let maskedKey: string | null = null;
    if (user.apiKey) {
      const key = user.apiKey;
      maskedKey = `${key.substring(0, 12)}${"*".repeat(key.length - 16)}${key.substring(key.length - 4)}`;
    }

    return NextResponse.json({
      hasApiKey: !!user.apiKey,
      maskedKey,
      tier: user.apiTier,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching API key:", error);
    return NextResponse.json(
      { error: "Failed to fetch API key" },
      { status: 500 }
    );
  }
}

// POST /api/user/api-key - Generate a new API key
export async function POST() {
  try {
    const session = await requireAuth();

    const apiKey = generateApiKey();

    await prisma.user.update({
      where: { id: session.user.id },
      data: { apiKey },
    });

    return NextResponse.json({
      apiKey,
      message: "API key generated successfully. Store it securely - it won't be shown again!",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error generating API key:", error);
    return NextResponse.json(
      { error: "Failed to generate API key" },
      { status: 500 }
    );
  }
}

// DELETE /api/user/api-key - Revoke API key
export async function DELETE() {
  try {
    const session = await requireAuth();

    await prisma.user.update({
      where: { id: session.user.id },
      data: { apiKey: null },
    });

    return NextResponse.json({
      message: "API key revoked successfully",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error revoking API key:", error);
    return NextResponse.json(
      { error: "Failed to revoke API key" },
      { status: 500 }
    );
  }
}
