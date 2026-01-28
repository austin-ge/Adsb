"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UptimeChart } from "@/components/charts/uptime-chart";
import { FeederStats } from "./types";

const RangeChart = dynamic(
  () => import("@/components/charts/range-chart").then((mod) => mod.RangeChart),
  { ssr: false, loading: () => <div className="h-48 animate-pulse bg-muted rounded" /> }
);

interface FeederChartsProps {
  stats: FeederStats[];
  hasLocation: boolean;
}

export function FeederCharts({ stats, hasLocation }: FeederChartsProps) {
  if (!stats || stats.length === 0) {
    return null;
  }

  // Reverse stats for chronological display (oldest to newest)
  const reversedStats = [...stats].reverse();

  return (
    <div
      className={`grid gap-6 ${
        hasLocation ? "md:grid-cols-2" : "md:grid-cols-1"
      }`}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">7-Day Uptime</CardTitle>
        </CardHeader>
        <CardContent>
          <UptimeChart
            data={reversedStats.map((stat) => ({
              timestamp: stat.timestamp,
              uptimePercent: stat.uptimePercent,
            }))}
          />
        </CardContent>
      </Card>
      {hasLocation && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Range History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <RangeChart
                data={reversedStats.map((stat) => ({
                  timestamp: stat.timestamp,
                  maxRange: stat.maxRange,
                  avgRange: stat.avgRange,
                }))}
                unit="nm"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
