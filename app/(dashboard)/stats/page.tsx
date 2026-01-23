"use client";

import useSWR from "swr";
import dynamic from "next/dynamic";
import { fetcher } from "@/lib/fetcher";
import { formatNumber } from "@/lib/format";
import {
  Radio,
  Users,
  MessageSquare,
  Plane,
  Activity,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const StatsCharts = dynamic(() => import("./stats-charts"), {
  ssr: false,
  loading: () => (
    <div className="grid md:grid-cols-2 gap-4">
      {[1, 2].map((i) => (
        <Card key={i} className="animate-pulse">
          <CardHeader><div className="h-4 bg-muted rounded w-1/2" /></CardHeader>
          <CardContent><div className="h-[200px] bg-muted rounded" /></CardContent>
        </Card>
      ))}
    </div>
  ),
});

interface NetworkStats {
  network: {
    totalFeeders: number;
    onlineFeeders: number;
    totalUsers: number;
    messagesTotal: string;
    positionsTotal: string;
    aircraftTracked: number;
  };
  live: {
    aircraft: number;
    withPosition: number;
    messageRate: number;
  };
  last24h: {
    messages: number;
    positions: number;
  };
  chartData: {
    hour: string;
    messages: number;
    positions: number;
    feeders: number;
  }[];
}


function formatHour(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function StatsPage() {
  const { data, error, isLoading } = useSWR<NetworkStats>(
    "/api/stats",
    fetcher,
    { refreshInterval: 30000 } // Refresh every 30 seconds
  );

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Network Statistics</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-red-500">Failed to load statistics</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Network Statistics</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const chartData = data.chartData.map((item) => ({
    ...item,
    time: formatHour(item.hour),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-balance">Network Statistics</h1>
        <p className="text-muted-foreground">
          Real-time and historical statistics for our ADS-B network
        </p>
      </div>

      {/* Live Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Live Aircraft
            </CardTitle>
            <Plane className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{data.live.aircraft}</div>
            <p className="text-xs text-muted-foreground">
              {data.live.withPosition} with position
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Online Feeders
            </CardTitle>
            <Radio className="h-4 w-4 text-green-500" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{data.network.onlineFeeders}</div>
            <p className="text-xs text-muted-foreground">
              of {data.network.totalFeeders} total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Message Rate
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {formatNumber(data.live.messageRate)}
            </div>
            <p className="text-xs text-muted-foreground">messages/sec</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Users
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{data.network.totalUsers}</div>
            <p className="text-xs text-muted-foreground">registered</p>
          </CardContent>
        </Card>
      </div>

      {/* All-Time Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Messages
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {formatNumber(data.network.messagesTotal)}
            </div>
            <p className="text-xs text-muted-foreground">all time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Positions
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {formatNumber(data.network.positionsTotal)}
            </div>
            <p className="text-xs text-muted-foreground">all time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Aircraft Tracked
            </CardTitle>
            <Plane className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {formatNumber(data.network.aircraftTracked)}
            </div>
            <p className="text-xs text-muted-foreground">unique aircraft</p>
          </CardContent>
        </Card>
      </div>

      {/* Last 24h Charts (dynamically loaded) */}
      <StatsCharts
        chartData={chartData}
        last24hMessages={data.last24h.messages}
        onlineFeeders={data.network.onlineFeeders}
        formatNumber={formatNumber}
      />
    </div>
  );
}
