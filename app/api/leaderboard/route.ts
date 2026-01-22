import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/leaderboard - Get top feeders
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sortBy = searchParams.get("sort") || "messages";
  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 100);
  const period = searchParams.get("period") || "all"; // all, day, week, month

  try {
    let orderBy: Record<string, string> = {};

    switch (sortBy) {
      case "positions":
        orderBy = { positionsTotal: "desc" };
        break;
      case "aircraft":
        orderBy = { aircraftSeen: "desc" };
        break;
      case "messages":
      default:
        orderBy = { messagesTotal: "desc" };
        break;
    }

    // For "all time" stats, query directly from feeders
    if (period === "all") {
      const feeders = await prisma.feeder.findMany({
        orderBy,
        take: limit,
        select: {
          id: true,
          name: true,
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
      });

      const leaderboard = feeders.map((feeder, index) => ({
        rank: index + 1,
        id: feeder.id,
        name: feeder.name,
        owner: feeder.user.name,
        messagesTotal: feeder.messagesTotal.toString(),
        positionsTotal: feeder.positionsTotal.toString(),
        aircraftSeen: feeder.aircraftSeen,
        isOnline: feeder.isOnline,
        lastSeen: feeder.lastSeen,
        memberSince: feeder.createdAt,
      }));

      return NextResponse.json({
        period: "all",
        sortBy,
        leaderboard,
      });
    }

    // For time-based periods, aggregate from stats
    let startDate: Date;
    const now = new Date();

    switch (period) {
      case "day":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0);
    }

    // Aggregate stats for the period
    const stats = await prisma.feederStats.groupBy({
      by: ["feederId"],
      where: {
        timestamp: { gte: startDate },
      },
      _sum: {
        messages: true,
        positions: true,
        aircraft: true,
      },
    });

    // Get feeder details
    const feederIds = stats.map((s) => s.feederId);
    const feeders = await prisma.feeder.findMany({
      where: { id: { in: feederIds } },
      select: {
        id: true,
        name: true,
        isOnline: true,
        lastSeen: true,
        createdAt: true,
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    const feederMap = new Map(feeders.map((f) => [f.id, f]));

    // Combine and sort
    let combined = stats.map((s) => ({
      feederId: s.feederId,
      messages: s._sum.messages || 0,
      positions: s._sum.positions || 0,
      aircraft: s._sum.aircraft || 0,
      feeder: feederMap.get(s.feederId),
    }));

    // Sort by requested field
    combined.sort((a, b) => {
      switch (sortBy) {
        case "positions":
          return b.positions - a.positions;
        case "aircraft":
          return b.aircraft - a.aircraft;
        case "messages":
        default:
          return b.messages - a.messages;
      }
    });

    // Limit results
    combined = combined.slice(0, limit);

    const leaderboard = combined.map((item, index) => ({
      rank: index + 1,
      id: item.feederId,
      name: item.feeder?.name || "Unknown",
      owner: item.feeder?.user.name || "Unknown",
      messages: item.messages,
      positions: item.positions,
      aircraft: item.aircraft,
      isOnline: item.feeder?.isOnline || false,
      lastSeen: item.feeder?.lastSeen,
      memberSince: item.feeder?.createdAt,
    }));

    return NextResponse.json({
      period,
      sortBy,
      leaderboard,
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
