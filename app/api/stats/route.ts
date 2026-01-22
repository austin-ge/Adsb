import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchAircraftData } from "@/lib/readsb";

// GET /api/stats - Get network-wide statistics
export async function GET() {
  try {
    // Get feeder counts
    const [totalFeeders, onlineFeeders] = await Promise.all([
      prisma.feeder.count(),
      prisma.feeder.count({ where: { isOnline: true } }),
    ]);

    // Get aggregated totals
    const totals = await prisma.feeder.aggregate({
      _sum: {
        messagesTotal: true,
        positionsTotal: true,
        aircraftSeen: true,
      },
    });

    // Get live aircraft count from tar1090
    const liveData = await fetchAircraftData();
    const liveAircraft = liveData?.aircraft?.length || 0;
    const liveWithPosition = liveData?.aircraft?.filter(
      (a) => a.lat !== undefined && a.lon !== undefined
    ).length || 0;

    // Get user count
    const totalUsers = await prisma.user.count();

    // Get stats for last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last24hStats = await prisma.feederStats.aggregate({
      where: {
        timestamp: { gte: oneDayAgo },
      },
      _sum: {
        messages: true,
        positions: true,
      },
    });

    // Get hourly stats for chart (last 24 hours)
    const hourlyStats = await prisma.$queryRaw<
      { hour: Date; messages: bigint; positions: bigint; feeders: bigint }[]
    >`
      SELECT
        date_trunc('hour', timestamp) as hour,
        SUM(messages) as messages,
        SUM(positions) as positions,
        COUNT(DISTINCT "feederId") as feeders
      FROM "FeederStats"
      WHERE timestamp >= ${oneDayAgo}
      GROUP BY date_trunc('hour', timestamp)
      ORDER BY hour ASC
    `;

    const chartData = hourlyStats.map((row) => ({
      hour: row.hour.toISOString(),
      messages: Number(row.messages),
      positions: Number(row.positions),
      feeders: Number(row.feeders),
    }));

    return NextResponse.json({
      network: {
        totalFeeders,
        onlineFeeders,
        totalUsers,
        messagesTotal: (totals._sum.messagesTotal || BigInt(0)).toString(),
        positionsTotal: (totals._sum.positionsTotal || BigInt(0)).toString(),
        aircraftTracked: totals._sum.aircraftSeen || 0,
      },
      live: {
        aircraft: liveAircraft,
        withPosition: liveWithPosition,
        messageRate: liveData?.messages || 0,
      },
      last24h: {
        messages: last24hStats._sum.messages || 0,
        positions: last24hStats._sum.positions || 0,
      },
      chartData,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
