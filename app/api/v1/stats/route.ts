import { NextRequest, NextResponse } from "next/server";
import { validateApiRequest } from "@/lib/api/middleware";
import { prisma } from "@/lib/prisma";
import { fetchAircraftData } from "@/lib/readsb";

// GET /api/v1/stats - Get network statistics
export async function GET(request: NextRequest) {
  // Validate API request and check rate limits
  const validation = await validateApiRequest(request);
  if (validation?.response) {
    return validation.response;
  }

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
    const liveWithPosition =
      liveData?.aircraft?.filter(
        (a) => a.lat !== undefined && a.lon !== undefined
      ).length || 0;

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
        network: {
          feeders: {
            total: totalFeeders,
            online: onlineFeeders,
          },
          messages_total: (totals._sum.messagesTotal || BigInt(0)).toString(),
          positions_total: (totals._sum.positionsTotal || BigInt(0)).toString(),
          aircraft_tracked: totals._sum.aircraftSeen || 0,
        },
        live: {
          aircraft: liveAircraft,
          aircraft_with_position: liveWithPosition,
          message_rate: liveData?.messages || 0,
          timestamp: liveData?.now || Date.now() / 1000,
        },
      },
      { headers }
    );
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
