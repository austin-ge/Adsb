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
import { useUnits, UNIT_CONVERSIONS } from "@/lib/units";

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
  const { units, altitudeUnitShort, speedUnitShort, formatAltitude: formatAltitudeUnit, formatSpeed: formatSpeedUnit } = useUnits();

  // Transform positions into chart data, converting units as needed
  const chartData = useMemo(() => {
    return positions.map((pos) => {
      let altitude = pos.alt;
      let speed = pos.spd;

      if (units === "metric") {
        altitude = pos.alt !== null ? Math.round(pos.alt * UNIT_CONVERSIONS.FEET_TO_METERS) : null;
        speed = pos.spd !== null ? Math.round(pos.spd * UNIT_CONVERSIONS.KNOTS_TO_KMH) : null;
      }

      return {
        time: pos.ts,
        altitude,
        speed,
        // Keep original values for tooltip formatting
        altitudeFt: pos.alt,
        speedKts: pos.spd,
        label: new Date(pos.ts).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
    });
  }, [positions, units]);

  // Calculate domain bounds based on chart data (already unit-converted)
  const { altMin, altMax, spdMin, spdMax } = useMemo(() => {
    let altMinVal = Infinity;
    let altMaxVal = -Infinity;
    let spdMinVal = Infinity;
    let spdMaxVal = -Infinity;

    for (const data of chartData) {
      if (data.altitude !== null) {
        altMinVal = Math.min(altMinVal, data.altitude);
        altMaxVal = Math.max(altMaxVal, data.altitude);
      }
      if (data.speed !== null) {
        spdMinVal = Math.min(spdMinVal, data.speed);
        spdMaxVal = Math.max(spdMaxVal, data.speed);
      }
    }

    // Add padding and round to nice values
    // Use different rounding for metric vs imperial
    const altRounding = units === "metric" ? 500 : 1000;
    const spdRounding = units === "metric" ? 100 : 50;
    const altPadding = (altMaxVal - altMinVal) * 0.1 || altRounding;
    const spdPadding = (spdMaxVal - spdMinVal) * 0.1 || spdRounding;

    return {
      altMin: Math.max(0, Math.floor((altMinVal - altPadding) / altRounding) * altRounding),
      altMax: Math.ceil((altMaxVal + altPadding) / altRounding) * altRounding,
      spdMin: Math.max(0, Math.floor((spdMinVal - spdPadding) / spdRounding) * spdRounding),
      spdMax: Math.ceil((spdMaxVal + spdPadding) / spdRounding) * spdRounding,
    };
  }, [chartData, units]);

  // Format altitude for axis ticks
  const formatAltitudeAxis = (value: number) => {
    if (units === "imperial" && value >= 18000) {
      return `FL${Math.round(value / 100)}`;
    }
    // Use k suffix for large values
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}k`;
    }
    return `${value}`;
  };

  const formatSpeedAxis = (value: number) => `${value}`;

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
            tickFormatter={formatAltitudeAxis}
            tick={{ fill: "#60a5fa", fontSize: 10 }}
            tickLine={{ stroke: "#4b5563" }}
            axisLine={{ stroke: "#4b5563" }}
            width={40}
            label={{
              value: altitudeUnitShort,
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
            tickFormatter={formatSpeedAxis}
            tick={{ fill: "#34d399", fontSize: 10 }}
            tickLine={{ stroke: "#4b5563" }}
            axisLine={{ stroke: "#4b5563" }}
            width={40}
            label={{
              value: speedUnitShort,
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
            formatter={(value: number, name: string, props: { payload?: { altitudeFt?: number; speedKts?: number } }) => {
              if (name === "altitude") {
                // Use original feet value for proper formatting
                const altFt = props.payload?.altitudeFt;
                if (altFt !== undefined && altFt !== null) {
                  return [formatAltitudeUnit(altFt), "Altitude"];
                }
                return [formatAltitudeUnit(value), "Altitude"];
              }
              // Use original knots value for proper formatting
              const spdKts = props.payload?.speedKts;
              if (spdKts !== undefined && spdKts !== null) {
                return [formatSpeedUnit(spdKts), "Speed"];
              }
              return [formatSpeedUnit(value), "Speed"];
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
