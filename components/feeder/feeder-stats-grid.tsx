"use client";

import { Trophy, Target, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import {
  Feeder,
  MonthlySummary,
  formatLastSeen,
  getRankChangeIndicator,
} from "./types";

interface FeederStatsGridProps {
  feeder: Feeder;
  monthlySummary: MonthlySummary | null;
}

export function FeederStatsGrid({ feeder, monthlySummary }: FeederStatsGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
            Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold">{feeder.currentScore}</p>
            {feeder.currentRank !== null && (
              <span className="text-sm text-muted-foreground">
                #{feeder.currentRank}
              </span>
            )}
            {(() => {
              const rankChange = getRankChangeIndicator(
                feeder.currentRank,
                feeder.previousRank
              );
              if (!rankChange) return null;
              const ChangeIcon = rankChange.icon;
              return (
                <ChangeIcon
                  className={`h-4 w-4 ${rankChange.color}`}
                  aria-label={rankChange.label}
                />
              );
            })()}
          </div>
        </CardContent>
      </Card>
      {(feeder.latitude !== null && feeder.longitude !== null) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5" aria-hidden="true" />
              Range
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col">
              <p className="text-2xl font-bold">
                {feeder.maxRangeNm !== null
                  ? `${feeder.maxRangeNm.toFixed(1)} nm`
                  : "--"}
              </p>
              <span className="text-xs text-muted-foreground">
                Avg 24h:{" "}
                {feeder.avgRangeNm24h !== null
                  ? `${feeder.avgRangeNm24h.toFixed(1)} nm`
                  : "--"}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Messages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {formatNumber(feeder.messagesTotal)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Positions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {formatNumber(feeder.positionsTotal)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Aircraft Seen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{feeder.aircraftSeen}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Last Seen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {formatLastSeen(feeder.lastSeen)}
          </p>
        </CardContent>
      </Card>
      {monthlySummary && (
        <Card className="col-span-2 md:col-span-3 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Messages</span>
                <span className="font-mono tabular-nums">{formatNumber(monthlySummary.totalMessages)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Positions</span>
                <span className="font-mono tabular-nums">{formatNumber(monthlySummary.totalPositions)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Aircraft</span>
                <span className="font-mono tabular-nums">{monthlySummary.maxAircraft}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg Uptime</span>
                <span className="font-mono tabular-nums">{monthlySummary.avgUptime}%</span>
              </div>
              <div className="flex justify-between col-span-2">
                <span className="text-muted-foreground">Days Active</span>
                <span className="font-mono tabular-nums">{monthlySummary.daysActive}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
