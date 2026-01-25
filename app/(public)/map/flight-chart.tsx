"use client";

import { useCallback, useMemo } from "react";
import {
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
} from "recharts";

export interface FlightPosition {
  lat: number;
  lon: number;
  alt: number | null;
  hdg: number | null;
  spd: number | null;
  ts: number;
}

interface FlightChartProps {
  positions: FlightPosition[];
  currentTime: number;
  onSeek: (time: number) => void;
}

export function FlightChart({ positions, currentTime, onSeek }: FlightChartProps) {
  // Transform positions into chart data
  const chartData = useMemo(() => {
    return positions.map((pos) => ({
      time: pos.ts,
      altitude: pos.alt,
      speed: pos.spd,
      label: new Date(pos.ts).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));
  }, [positions]);

  // Calculate domain bounds
  const { altMin, altMax, spdMin, spdMax } = useMemo(() => {
    let altMinVal = Infinity;
    let altMaxVal = -Infinity;
    let spdMinVal = Infinity;
    let spdMaxVal = -Infinity;

    for (const pos of positions) {
      if (pos.alt !== null) {
        altMinVal = Math.min(altMinVal, pos.alt);
        altMaxVal = Math.max(altMaxVal, pos.alt);
      }
      if (pos.spd !== null) {
        spdMinVal = Math.min(spdMinVal, pos.spd);
        spdMaxVal = Math.max(spdMaxVal, pos.spd);
      }
    }

    // Add padding and round to nice values
    const altPadding = (altMaxVal - altMinVal) * 0.1 || 1000;
    const spdPadding = (spdMaxVal - spdMinVal) * 0.1 || 50;

    return {
      altMin: Math.max(0, Math.floor((altMinVal - altPadding) / 1000) * 1000),
      altMax: Math.ceil((altMaxVal + altPadding) / 1000) * 1000,
      spdMin: Math.max(0, Math.floor((spdMinVal - spdPadding) / 50) * 50),
      spdMax: Math.ceil((spdMaxVal + spdPadding) / 50) * 50,
    };
  }, [positions]);

  const formatAltitude = (value: number) => {
    if (value >= 18000) return `FL${Math.round(value / 100)}`;
    return `${(value / 1000).toFixed(0)}k`;
  };

  const formatSpeed = (value: number) => `${value}`;

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleChartClick = useCallback(
    (data: { activePayload?: Array<{ payload: { time: number } }> }) => {
      if (data.activePayload && data.activePayload[0]) {
        const time = data.activePayload[0].payload.time;
        onSeek(time);
      }
    },
    [onSeek]
  );

  if (positions.length < 2) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-gray-500">
        Not enough position data to display chart
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 10, right: 45, left: 0, bottom: 5 }}
          onClick={handleChartClick}
        >
          {/* X-axis: time */}
          <XAxis
            dataKey="time"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={formatTime}
            tick={{ fill: "#9ca3af", fontSize: 10 }}
            tickLine={{ stroke: "#4b5563" }}
            axisLine={{ stroke: "#4b5563" }}
            interval="preserveStartEnd"
            minTickGap={60}
          />

          {/* Y-axis left: altitude */}
          <YAxis
            yAxisId="altitude"
            orientation="left"
            domain={[altMin, altMax]}
            tickFormatter={formatAltitude}
            tick={{ fill: "#60a5fa", fontSize: 10 }}
            tickLine={{ stroke: "#4b5563" }}
            axisLine={{ stroke: "#4b5563" }}
            width={40}
            label={{
              value: "ft",
              angle: -90,
              position: "insideLeft",
              fill: "#60a5fa",
              fontSize: 10,
              offset: 10,
            }}
          />

          {/* Y-axis right: speed */}
          <YAxis
            yAxisId="speed"
            orientation="right"
            domain={[spdMin, spdMax]}
            tickFormatter={formatSpeed}
            tick={{ fill: "#34d399", fontSize: 10 }}
            tickLine={{ stroke: "#4b5563" }}
            axisLine={{ stroke: "#4b5563" }}
            width={40}
            label={{
              value: "kts",
              angle: 90,
              position: "insideRight",
              fill: "#34d399",
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
            labelFormatter={(value) => formatTime(value as number)}
            formatter={(value: number, name: string) => {
              if (name === "altitude") {
                const alt = value;
                if (alt >= 18000) return [`FL${Math.round(alt / 100)}`, "Altitude"];
                return [`${alt.toLocaleString()} ft`, "Altitude"];
              }
              return [`${Math.round(value)} kts`, "Speed"];
            }}
          />

          {/* Altitude area */}
          <Area
            yAxisId="altitude"
            type="monotone"
            dataKey="altitude"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#altitudeGradient)"
            connectNulls
            isAnimationActive={false}
          />

          {/* Speed line */}
          <Line
            yAxisId="speed"
            type="monotone"
            dataKey="speed"
            stroke="#10b981"
            strokeWidth={1.5}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />

          {/* Current time reference line */}
          {currentTime > 0 && (
            <ReferenceLine
              x={currentTime}
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="4 2"
              yAxisId="altitude"
            />
          )}

          {/* Gradient definition */}
          <defs>
            <linearGradient id="altitudeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
            </linearGradient>
          </defs>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
