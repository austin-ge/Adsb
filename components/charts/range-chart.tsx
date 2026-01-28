"use client";

import { useMemo } from "react";
import {
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";

interface RangeChartProps {
  data: Array<{
    timestamp: string;
    maxRange: number | null;
    avgRange: number | null;
  }>;
  unit?: "nm" | "km" | "mi";
}

// Unit conversion constants (base unit: nautical miles)
const UNIT_CONVERSIONS = {
  nm: 1,
  km: 1.852,
  mi: 1.15078,
} as const;

const UNIT_LABELS = {
  nm: "nm",
  km: "km",
  mi: "mi",
} as const;

export function RangeChart({ data, unit = "nm" }: RangeChartProps) {
  // Transform data with unit conversions
  const chartData = useMemo(() => {
    const conversion = UNIT_CONVERSIONS[unit];
    return data.map((item) => ({
      timestamp: item.timestamp,
      maxRange:
        item.maxRange !== null
          ? Math.round(item.maxRange * conversion * 10) / 10
          : null,
      avgRange:
        item.avgRange !== null
          ? Math.round(item.avgRange * conversion * 10) / 10
          : null,
      time: formatTimeLabel(item.timestamp),
    }));
  }, [data, unit]);

  // Calculate Y-axis domain with padding
  const yDomain = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;

    for (const item of chartData) {
      if (item.maxRange !== null) {
        min = Math.min(min, item.maxRange);
        max = Math.max(max, item.maxRange);
      }
      if (item.avgRange !== null) {
        min = Math.min(min, item.avgRange);
        max = Math.max(max, item.avgRange);
      }
    }

    if (min === Infinity || max === -Infinity) {
      return [0, 100];
    }

    const padding = (max - min) * 0.1 || 10;
    return [Math.max(0, Math.floor(min - padding)), Math.ceil(max + padding)];
  }, [chartData]);

  const unitLabel = UNIT_LABELS[unit];

  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-gray-500">
        No range data available
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
        >
          {/* Gradient definition for max range area */}
          <defs>
            <linearGradient id="rangeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
            </linearGradient>
          </defs>

          {/* X-axis: time */}
          <XAxis
            dataKey="time"
            tick={{ fill: "#9ca3af", fontSize: 10 }}
            tickLine={{ stroke: "#4b5563" }}
            axisLine={{ stroke: "#4b5563" }}
            interval="preserveStartEnd"
            minTickGap={50}
          />

          {/* Y-axis: range */}
          <YAxis
            domain={yDomain}
            tick={{ fill: "#9ca3af", fontSize: 10 }}
            tickLine={{ stroke: "#4b5563" }}
            axisLine={{ stroke: "#4b5563" }}
            width={45}
            tickFormatter={(value) => `${value}`}
            label={{
              value: unitLabel,
              angle: -90,
              position: "insideLeft",
              fill: "#9ca3af",
              fontSize: 10,
              offset: 10,
            }}
          />

          {/* Tooltip */}
          <Tooltip
            contentStyle={{
              backgroundColor: "#1f2937",
              border: "1px solid #374151",
              borderRadius: "6px",
              fontSize: "12px",
            }}
            labelStyle={{ color: "#9ca3af", marginBottom: "4px" }}
            formatter={(value: number, name: string) => {
              if (value === null || value === undefined) {
                return ["--", name === "maxRange" ? "Max Range" : "Avg Range"];
              }
              const formattedValue = `${value.toFixed(1)} ${unitLabel}`;
              return [formattedValue, name === "maxRange" ? "Max Range" : "Avg Range"];
            }}
            labelFormatter={(label) => String(label)}
          />

          {/* Max range area (blue, semi-transparent fill) */}
          <Area
            type="monotone"
            dataKey="maxRange"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#rangeGradient)"
            connectNulls
            isAnimationActive={false}
          />

          {/* Avg range line (dashed, darker blue) */}
          <Line
            type="monotone"
            dataKey="avgRange"
            stroke="#1d4ed8"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Format timestamp string into a readable time label
 */
function formatTimeLabel(timestamp: string): string {
  const date = new Date(timestamp);

  // Check if it's a valid date
  if (isNaN(date.getTime())) {
    return timestamp;
  }

  // If timestamp includes date info spanning multiple days, show date + time
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
