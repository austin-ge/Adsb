"use client";

import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface UptimeDataPoint {
  timestamp: string;
  uptimePercent: number | null;
}

interface UptimeChartProps {
  data: UptimeDataPoint[];
  className?: string;
}

function getUptimeColor(uptimePercent: number | null): string {
  if (uptimePercent === null) return "bg-gray-600";
  if (uptimePercent >= 95) return "bg-green-500";
  if (uptimePercent >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

function formatDateTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDayLabel(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { weekday: "short" });
}

export function UptimeChart({ data, className }: UptimeChartProps) {
  // Organize data into 7 days x 24 hours grid
  // Expects data to be sorted chronologically with 168 entries (7 days * 24 hours)
  const grid = React.useMemo(() => {
    const rows: UptimeDataPoint[][] = [];

    for (let day = 0; day < 7; day++) {
      const dayData: UptimeDataPoint[] = [];
      for (let hour = 0; hour < 24; hour++) {
        const index = day * 24 + hour;
        if (index < data.length) {
          dayData.push(data[index]);
        } else {
          // Fill with empty data if not enough entries
          dayData.push({ timestamp: "", uptimePercent: null });
        }
      }
      rows.push(dayData);
    }

    return rows;
  }, [data]);

  // Get day labels from the first entry of each row
  const dayLabels = React.useMemo(() => {
    return grid.map((row) => {
      const firstValid = row.find((d) => d.timestamp);
      return firstValid ? getDayLabel(firstValid.timestamp) : "";
    });
  }, [grid]);

  return (
    <TooltipProvider delayDuration={100}>
      <div className={cn("flex flex-col gap-1", className)}>
        {/* Hour labels */}
        <div className="flex items-center gap-1 pl-10">
          {[0, 6, 12, 18].map((hour) => (
            <div
              key={hour}
              className="text-[10px] text-gray-400"
              style={{
                width: hour === 0 ? "0" : undefined,
                marginLeft: hour === 0 ? "0" : `${(hour - (hour === 6 ? 0 : (hour === 12 ? 6 : 12))) * 12 - 6}px`
              }}
            >
              {hour === 0 ? "12a" : hour === 6 ? "6a" : hour === 12 ? "12p" : "6p"}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {grid.map((row, dayIndex) => (
          <div key={dayIndex} className="flex items-center gap-1">
            {/* Day label */}
            <div className="w-8 text-[10px] text-gray-400 text-right pr-1 shrink-0">
              {dayLabels[dayIndex]}
            </div>

            {/* Hour cells */}
            <div className="flex gap-px">
              {row.map((cell, hourIndex) => (
                <Tooltip key={hourIndex}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "w-2.5 h-2.5 rounded-sm transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900",
                        getUptimeColor(cell.uptimePercent)
                      )}
                      aria-label={
                        cell.timestamp
                          ? `${formatDateTime(cell.timestamp)}: ${
                              cell.uptimePercent !== null
                                ? `${cell.uptimePercent.toFixed(1)}% uptime`
                                : "No data"
                            }`
                          : "No data"
                      }
                    />
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="bg-gray-800 border border-gray-700 text-gray-100"
                  >
                    {cell.timestamp ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-gray-300">
                          {formatDateTime(cell.timestamp)}
                        </span>
                        <span className="font-medium">
                          {cell.uptimePercent !== null
                            ? `${cell.uptimePercent.toFixed(1)}% uptime`
                            : "No data"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400">No data</span>
                    )}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-3 mt-2 pl-10 text-[10px] text-gray-400">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-green-500" />
            <span>&gt;95%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-yellow-500" />
            <span>50-95%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-red-500" />
            <span>&lt;50%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-gray-600" />
            <span>No data</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
