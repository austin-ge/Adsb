"use client";

import { Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import { DailyStats } from "./types";

interface DailyStatsTableProps {
  stats: DailyStats[];
}

export function DailyStatsTable({ stats }: DailyStatsTableProps) {
  if (stats.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" aria-hidden="true" />
          7-Day Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Feeder statistics for the past 7 days</caption>
            <thead>
              <tr className="border-b border-gray-700">
                <th scope="col" className="text-left py-2 px-2 font-medium text-muted-foreground">
                  Date
                </th>
                <th scope="col" className="text-right py-2 px-2 font-medium text-muted-foreground">
                  Messages
                </th>
                <th scope="col" className="text-right py-2 px-2 font-medium text-muted-foreground">
                  Positions
                </th>
                <th scope="col" className="text-right py-2 px-2 font-medium text-muted-foreground">
                  Aircraft
                </th>
                <th scope="col" className="text-right py-2 px-2 font-medium text-muted-foreground">
                  Avg Score
                </th>
                <th scope="col" className="text-right py-2 px-2 font-medium text-muted-foreground">
                  Uptime
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.map((day) => (
                <tr
                  key={day.dateKey}
                  className={`border-b border-gray-800 last:border-0 transition-colors ${
                    day.isToday ? "bg-blue-500/10" : "hover:bg-gray-800/50"
                  }`}
                >
                  <td className="py-2 px-2">
                    <span className={day.isToday ? "font-medium" : ""}>
                      {day.date}
                      {day.isToday && (
                        <span className="ml-1.5 text-xs text-blue-400">(Today)</span>
                      )}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right font-mono tabular-nums">
                    {formatNumber(day.messages)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono tabular-nums">
                    {formatNumber(day.positions)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono tabular-nums">
                    {day.aircraft}
                  </td>
                  <td className="py-2 px-2 text-right font-mono tabular-nums">
                    {day.avgScore}%
                  </td>
                  <td className="py-2 px-2 text-right font-mono tabular-nums">
                    <span
                      className={
                        day.uptimePercent >= 90
                          ? "text-green-500"
                          : day.uptimePercent >= 50
                            ? "text-amber-400"
                            : "text-red-500"
                      }
                    >
                      {day.uptimePercent}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
