"use client";

import { useMemo } from "react";
import { Layer, Source } from "react-map-gl/mapbox";
import useSWR from "swr";

interface Airport {
  icao: string;
  iata: string;
  name: string;
  lat: number;
  lon: number;
}

interface AirportMarkersProps {
  visible: boolean;
  isLightMap: boolean;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function AirportMarkers({ visible, isLightMap }: AirportMarkersProps) {
  const { data: airports } = useSWR<Airport[]>(
    visible ? "/data/airports.json" : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Build GeoJSON from airport data
  const geojson = useMemo(() => {
    if (!airports || airports.length === 0) {
      return {
        type: "FeatureCollection" as const,
        features: [],
      };
    }

    return {
      type: "FeatureCollection" as const,
      features: airports.map((airport) => ({
        type: "Feature" as const,
        properties: {
          icao: airport.icao,
          iata: airport.iata,
          name: airport.name,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [airport.lon, airport.lat],
        },
      })),
    };
  }, [airports]);

  // Theme-aware colors
  const textColor = isLightMap ? "#1e293b" : "#e2e8f0";
  const haloColor = isLightMap ? "#ffffff" : "#0f172a";

  if (!visible) {
    return null;
  }

  return (
    <Source id="airport-markers" type="geojson" data={geojson}>
      <Layer
        id="airport-markers-layer"
        type="symbol"
        minzoom={4}
        maxzoom={14}
        layout={{
          // Use Mapbox's built-in airport icon
          "icon-image": "airport",
          // Zoom-based interpolation for icon size
          "icon-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4, 0.4,
            6, 0.6,
            8, 0.8,
            10, 1.0,
            14, 1.2,
          ],
          "icon-allow-overlap": false,
          "icon-ignore-placement": false,
          // Text label showing ICAO code below the icon
          "text-field": ["get", "icao"],
          "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"],
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4, 8,
            6, 9,
            8, 10,
            10, 11,
            14, 12,
          ],
          "text-anchor": "top",
          "text-offset": [0, 0.8],
          "text-allow-overlap": false,
          "text-optional": true,
        }}
        paint={{
          // Icon opacity with zoom-based fade in
          "icon-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4, 0.3,
            5, 0.6,
            6, 0.9,
            8, 1,
          ],
          // Text color based on theme
          "text-color": textColor,
          // Text halo for readability
          "text-halo-color": haloColor,
          "text-halo-width": 1.5,
          "text-halo-blur": 0.5,
          // Text opacity with zoom-based fade in (appears slightly after icon)
          "text-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4, 0,
            5, 0.3,
            6, 0.7,
            8, 1,
          ],
        }}
      />
    </Source>
  );
}
