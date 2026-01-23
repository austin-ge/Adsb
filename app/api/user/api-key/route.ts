import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-server";
import { randomBytes, createHash } from "crypto";

// Generate a secure API key
function generateApiKey(): string {
  // Format: adsb_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx (32 random hex chars)
  const randomPart = randomBytes(16).toString("hex");
  return `adsb_live_${randomPart}`;
}

// Hash an API key for storage
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// GET /api/user/api-key - Get current API key (masked)
export async function GET() {
  try {
    const session = await requireAuth();

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { apiKeyHash: true, apiKeyPrefix: true, apiTier: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      hasApiKey: !!user.apiKeyHash,
      keyPrefix: user.apiKeyPrefix,
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
    const apiKeyHash = hashApiKey(apiKey);
    const apiKeyPrefix = apiKey.substring(0, 14) + "...";

    await prisma.user.update({
      where: { id: session.user.id },
      data: { apiKeyHash, apiKeyPrefix },
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
      data: { apiKeyHash: null, apiKeyPrefix: null },
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
