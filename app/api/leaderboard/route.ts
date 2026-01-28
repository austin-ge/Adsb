import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { captureException } from "@/lib/sentry";

// Valid sort options
type SortOption = "score" | "aircraft" | "messages" | "maxRange" | "avgRange";
const VALID_SORTS: SortOption[] = [
  "score",
  "aircraft",
  "messages",
  "maxRange",
  "avgRange",
];

// GET /api/leaderboard - Get top feeders
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sortBy = searchParams.get("sort") || "score";
  const search = searchParams.get("search")?.trim() || "";
  const limitRaw = parseInt(searchParams.get("limit") || "10", 10);
  const limit = Number.isNaN(limitRaw) ? 10 : Math.min(Math.max(1, limitRaw), 100);
  const period = searchParams.get("period") || "all"; // all, day, week, month

  // Validate sort parameter
  const validSort = VALID_SORTS.includes(sortBy as SortOption)
    ? (sortBy as SortOption)
    : "score";

  try {
    // Build orderBy based on sort param
    // For range sorting, we need to handle nulls (put them last)
    let orderBy: Prisma.FeederOrderByWithRelationInput[];

    switch (validSort) {
      case "score":
        orderBy = [{ currentScore: "desc" }, { messagesTotal: "desc" }];
        break;
      case "aircraft":
        orderBy = [{ aircraftSeen: "desc" }];
        break;
      case "messages":
        orderBy = [{ messagesTotal: "desc" }];
        break;
      case "maxRange":
        // Prisma puts nulls last by default for desc
        orderBy = [
          { maxRangeNm: { sort: "desc", nulls: "last" } },
          { messagesTotal: "desc" },
        ];
        break;
      case "avgRange":
        orderBy = [
          { avgRangeNm24h: { sort: "desc", nulls: "last" } },
          { messagesTotal: "desc" },
        ];
        break;
      default:
        orderBy = [{ currentScore: "desc" }, { messagesTotal: "desc" }];
    }

    // Build where clause for search
    const where: Prisma.FeederWhereInput = search
      ? { name: { contains: search, mode: "insensitive" } }
      : {};

    // For "all time" stats, query directly from feeders
    if (period === "all") {
      const feeders = await prisma.feeder.findMany({
        where,
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
          // New fields for Phase 7
          currentScore: true,
          maxRangeNm: true,
          avgRangeNm24h: true,
          currentRank: true,
          previousRank: true,
          user: {
            select: {
              name: true,
            },
          },
        },
      });

      const leaderboard = feeders.map((feeder, index) => {
        // Calculate rank change (positive = moved up)
        const rankChange =
          feeder.previousRank !== null && feeder.currentRank !== null
            ? feeder.previousRank - feeder.currentRank
            : null;

        return {
          // Existing fields (backward compatible)
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
          // New fields for Phase 7
          score: feeder.currentScore,
          maxRange: feeder.maxRangeNm,
          avgRange: feeder.avgRangeNm24h,
          storedRank: feeder.currentRank,
          rankChange,
        };
      });

      return NextResponse.json({
        period: "all",
        sortBy: validSort,
        search: search || undefined,
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

    // First, get matching feeder IDs if search is provided
    let searchFeederIds: string[] | undefined;
    if (search) {
      const matchingFeeders = await prisma.feeder.findMany({
        where: { name: { contains: search, mode: "insensitive" } },
        select: { id: true },
        take: 1000, // Reasonable limit for search results
      });
      searchFeederIds = matchingFeeders.map((f) => f.id);

      // If no feeders match the search, return empty results
      if (searchFeederIds.length === 0) {
        return NextResponse.json({
          period,
          sortBy: validSort,
          search,
          leaderboard: [],
        });
      }
    }

    // Aggregate stats for the period
    const stats = await prisma.feederStats.groupBy({
      by: ["feederId"],
      where: {
        timestamp: { gte: startDate },
        ...(searchFeederIds ? { feederId: { in: searchFeederIds } } : {}),
      },
      _sum: {
        messages: true,
        positions: true,
        aircraft: true,
        score: true,
      },
      _max: {
        maxRange: true,
      },
      _avg: {
        avgRange: true,
        score: true,
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
        currentRank: true,
        previousRank: true,
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
      score: Math.round(s._avg.score || 0),
      maxRange: s._max.maxRange,
      avgRange: s._avg.avgRange,
      feeder: feederMap.get(s.feederId),
    }));

    // Sort by requested field
    combined.sort((a, b) => {
      switch (validSort) {
        case "score":
          return b.score - a.score;
        case "aircraft":
          return b.aircraft - a.aircraft;
        case "maxRange":
          // Nulls go last
          if (a.maxRange === null && b.maxRange === null) return 0;
          if (a.maxRange === null) return 1;
          if (b.maxRange === null) return -1;
          return b.maxRange - a.maxRange;
        case "avgRange":
          // Nulls go last
          if (a.avgRange === null && b.avgRange === null) return 0;
          if (a.avgRange === null) return 1;
          if (b.avgRange === null) return -1;
          return b.avgRange - a.avgRange;
        case "messages":
        default:
          return b.messages - a.messages;
      }
    });

    // Limit results
    combined = combined.slice(0, limit);

    const leaderboard = combined.map((item, index) => {
      const feeder = item.feeder;
      const rankChange =
        feeder?.previousRank !== null &&
        feeder?.previousRank !== undefined &&
        feeder?.currentRank !== null &&
        feeder?.currentRank !== undefined
          ? feeder.previousRank - feeder.currentRank
          : null;

      return {
        // Existing fields (backward compatible)
        rank: index + 1,
        id: item.feederId,
        name: feeder?.name || "Unknown",
        owner: feeder?.user.name || "Unknown",
        messages: item.messages,
        positions: item.positions,
        aircraft: item.aircraft,
        isOnline: feeder?.isOnline || false,
        lastSeen: feeder?.lastSeen,
        memberSince: feeder?.createdAt,
        // New fields for Phase 7
        score: item.score,
        maxRange: item.maxRange,
        avgRange: item.avgRange,
        storedRank: feeder?.currentRank,
        rankChange,
      };
    });

    return NextResponse.json({
      period,
      sortBy: validSort,
      search: search || undefined,
      leaderboard,
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    captureException(error, {
      tags: { "api.endpoint": "leaderboard" },
    });
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
