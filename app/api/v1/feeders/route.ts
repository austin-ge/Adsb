import { NextRequest, NextResponse } from "next/server";
import { validateApiRequest, requireFeederTier } from "@/lib/api/middleware";
import { prisma } from "@/lib/prisma";

// GET /api/v1/feeders - Get public feeder list
// Requires FEEDER tier or higher for full access
export async function GET(request: NextRequest) {
  // Validate API request and check rate limits
  const validation = await validateApiRequest(request);
  if (validation?.response) {
    return validation.response;
  }

  const { searchParams } = new URL(request.url);
  const onlyOnline = searchParams.get("online") === "true";
  const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);
  const offset = parseInt(searchParams.get("offset") || "0");

  // Check if user has FEEDER tier for full access
  const tierCheck = requireFeederTier(validation!.context);
  const hasFullAccess = !tierCheck;

  try {
    const where = onlyOnline ? { isOnline: true } : {};

    const [feeders, total] = await Promise.all([
      prisma.feeder.findMany({
        where,
        orderBy: { messagesTotal: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          name: true,
          // Only show location for FEEDER+ tier
          latitude: hasFullAccess,
          longitude: hasFullAccess,
          messagesTotal: true,
          positionsTotal: true,
          aircraftSeen: true,
          isOnline: true,
          lastSeen: true,
          createdAt: true,
          user: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.feeder.count({ where }),
    ]);

    // Build response with rate limit headers
    const headers = new Headers();
    if (validation?.context.rateLimit) {
      headers.set(
        "X-RateLimit-Limit",
        String(validation.context.rateLimit.limit)
      );
      headers.set(
        "X-RateLimit-Remaining",
        String(validation.context.rateLimit.remaining)
      );
      headers.set(
        "X-RateLimit-Reset",
        String(validation.context.rateLimit.reset)
      );
    }

    return NextResponse.json(
      {
        total,
        limit,
        offset,
        has_more: offset + feeders.length < total,
        feeders: feeders.map((f) => ({
          id: f.id,
          name: f.name,
          owner: f.user.name,
          // Only include location for FEEDER+ tier
          ...(hasFullAccess && {
            latitude: f.latitude,
            longitude: f.longitude,
          }),
          stats: {
            messages_total: f.messagesTotal.toString(),
            positions_total: f.positionsTotal.toString(),
            aircraft_seen: f.aircraftSeen,
          },
          is_online: f.isOnline,
          last_seen: f.lastSeen,
          member_since: f.createdAt,
        })),
      },
      { headers }
    );
  } catch (error) {
    console.error("Error fetching feeders:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
