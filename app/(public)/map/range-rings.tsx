"use client";

import { useMemo } from "react";
import { Source, Layer } from "react-map-gl/mapbox";
import * as turf from "@turf/turf";

// Nautical miles to kilometers conversion
const NM_TO_KM = 1.852;

// Range ring distances in nautical miles
const RANGE_DISTANCES_NM = [25, 50, 100, 150, 200];

interface RangeRingsProps {
  center: { lat: number; lng: number } | null;
  visible: boolean;
}

export function RangeRings({ center, visible }: RangeRingsProps) {
  // Generate circle polygons using turf.js
  const geojson = useMemo(() => {
    if (!center) {
      return {
        type: "FeatureCollection" as const,
        features: [],
      };
    }

    const features: GeoJSON.Feature[] = [];

    for (const distanceNm of RANGE_DISTANCES_NM) {
      const distanceKm = distanceNm * NM_TO_KM;
      // Generate circle with 64 points for smoothness
      const circle = turf.circle([center.lng, center.lat], distanceKm, {
        steps: 64,
        units: "kilometers",
      });

      features.push({
        type: "Feature",
        properties: {
          distance: distanceNm,
          label: `${distanceNm}nm`,
        },
        geometry: circle.geometry,
      });
    }

    return {
      type: "FeatureCollection" as const,
      features,
    };
  }, [center]);

  // Generate label points (positioned at the top of each ring)
  const labelGeojson = useMemo(() => {
    if (!center) {
      return {
        type: "FeatureCollection" as const,
        features: [],
      };
    }

    const features: GeoJSON.Feature[] = [];

    for (const distanceNm of RANGE_DISTANCES_NM) {
      const distanceKm = distanceNm * NM_TO_KM;
      // Calculate point at bearing 0 (north) from center
      const destination = turf.destination(
        [center.lng, center.lat],
        distanceKm,
        0, // North bearing
        { units: "kilometers" }
      );

      features.push({
        type: "Feature",
        properties: {
          label: `${distanceNm}nm`,
        },
        geometry: destination.geometry,
      });
    }

    return {
      type: "FeatureCollection" as const,
      features,
    };
  }, [center]);

  // Generate center point for display
  const centerGeojson = useMemo(() => {
    if (!center) {
      return {
        type: "FeatureCollection" as const,
        features: [],
      };
    }

    return {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: {},
          geometry: {
            type: "Point" as const,
            coordinates: [center.lng, center.lat],
          },
        },
      ],
    };
  }, [center]);

  if (!visible || !center) {
    return null;
  }

  return (
    <>
      {/* Range ring circles */}
      <Source id="range-rings" type="geojson" data={geojson}>
        <Layer
          id="range-rings-fill"
          type="fill"
          paint={{
            "fill-color": "#3b82f6",
            "fill-opacity": 0.03,
          }}
        />
        <Layer
          id="range-rings-line"
          type="line"
          paint={{
            "line-color": "#3b82f6",
            "line-width": 1,
            "line-opacity": 0.3,
            "line-dasharray": [4, 4],
          }}
        />
      </Source>

      {/* Range ring labels */}
      <Source id="range-ring-labels" type="geojson" data={labelGeojson}>
        <Layer
          id="range-ring-labels-text"
          type="symbol"
          layout={{
            "text-field": ["get", "label"],
            "text-size": 11,
            "text-anchor": "bottom",
            "text-offset": [0, -0.5],
            "text-allow-overlap": false,
          }}
          paint={{
            "text-color": "#60a5fa",
            "text-halo-color": "#0f172a",
            "text-halo-width": 1.5,
            "text-opacity": 0.8,
          }}
        />
      </Source>

      {/* Center marker */}
      <Source id="range-center" type="geojson" data={centerGeojson}>
        <Layer
          id="range-center-outer"
          type="circle"
          paint={{
            "circle-radius": 8,
            "circle-color": "#3b82f6",
            "circle-opacity": 0.2,
          }}
        />
        <Layer
          id="range-center-inner"
          type="circle"
          paint={{
            "circle-radius": 4,
            "circle-color": "#3b82f6",
            "circle-opacity": 0.6,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-opacity": 0.8,
          }}
        />
      </Source>
    </>
  );
}
