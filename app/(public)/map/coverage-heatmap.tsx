"use client";

import { useMemo } from "react";
import { Layer, Source } from "react-map-gl/mapbox";

interface CoveragePoint {
  lat: number;
  lon: number;
  count: number;
}

interface CoverageHeatmapProps {
  points: CoveragePoint[];
  maxCount: number;
  visible: boolean;
}

export function CoverageHeatmap({ points, maxCount, visible }: CoverageHeatmapProps) {
  // Build GeoJSON from coverage points
  const geojson = useMemo(() => {
    if (!points || points.length === 0) {
      return {
        type: "FeatureCollection" as const,
        features: [],
      };
    }

    return {
      type: "FeatureCollection" as const,
      features: points.map((point) => ({
        type: "Feature" as const,
        properties: {
          // Normalize count relative to max for consistent heatmap intensity
          weight: maxCount > 0 ? point.count / maxCount : 0,
          count: point.count,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [point.lon, point.lat],
        },
      })),
    };
  }, [points, maxCount]);

  if (!visible) {
    return null;
  }

  return (
    <Source id="coverage-heatmap" type="geojson" data={geojson}>
      <Layer
        id="coverage-heatmap-layer"
        type="heatmap"
        paint={{
          // Increase weight based on position count
          "heatmap-weight": [
            "interpolate",
            ["linear"],
            ["get", "weight"],
            0, 0,
            0.1, 0.3,
            0.5, 0.6,
            1, 1,
          ],
          // Increase intensity as zoom level increases
          "heatmap-intensity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0, 0.5,
            5, 1,
            10, 2,
          ],
          // Color gradient: transparent -> blue -> cyan -> green -> yellow -> red
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0, "rgba(0, 0, 0, 0)",
            0.1, "rgba(30, 58, 138, 0.4)",   // Dark blue
            0.2, "rgba(59, 130, 246, 0.5)",  // Blue
            0.4, "rgba(6, 182, 212, 0.6)",   // Cyan
            0.6, "rgba(34, 197, 94, 0.7)",   // Green
            0.8, "rgba(250, 204, 21, 0.8)",  // Yellow
            1.0, "rgba(239, 68, 68, 0.9)",   // Red
          ],
          // Adjust radius with zoom level
          "heatmap-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0, 8,
            3, 15,
            5, 25,
            8, 40,
            12, 60,
          ],
          // Fade out heatmap at higher zoom levels
          "heatmap-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0, 0.7,
            10, 0.5,
            14, 0.3,
          ],
        }}
      />
    </Source>
  );
}
