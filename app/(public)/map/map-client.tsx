"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import MapGL, { Layer, Source, MapRef, MapMouseEvent, ViewStateChangeEvent } from "react-map-gl/mapbox";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { fetcher } from "@/lib/fetcher";
import {
  Aircraft,
  AircraftResponse,
  getAltitudeColor,
  getEmergencyInfo,
} from "./types";

// Mapbox styles - map style is independent from UI theme
const MAPBOX_STYLES = {
  streets: "mapbox://styles/mapbox/streets-v12",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  dark: "mapbox://styles/mapbox/dark-v11",
  light: "mapbox://styles/mapbox/light-v11",
} as const;

type MapStyleKey = keyof typeof MAPBOX_STYLES;

const MAP_STYLE_STORAGE_KEY = "hangartrak-map-style";
import {
  AIRCRAFT_ICON_TYPES,
  getIconImageName,
  getIconTypeFromCategory,
  renderAircraftIcon,
} from "./aircraft-icons";
import { AircraftSidebar } from "./aircraft-sidebar";
import { PlaybackControls } from "./playback-controls";
import { FlightChart, FlightPosition } from "./flight-chart";
import { RangeRings } from "./range-rings";
import { MapControls } from "./map-controls";
import { CoverageHeatmap } from "./coverage-heatmap";
import { AirportMarkers } from "./airport-markers";
import {
  SelectedAircraftPanel,
  StatsOverlay,
  AltitudeLegend,
  LoadingOverlay,
  FlightLoadingOverlay,
  FlightErrorToast,
} from "@/components/map";

function buildAircraftGeojson(aircraft: Aircraft[]) {
  return {
    type: "FeatureCollection" as const,
    features: aircraft.map((ac) => {
      const emergency = getEmergencyInfo(ac.squawk);
      const iconType = getIconTypeFromCategory(ac.category);
      return {
        type: "Feature" as const,
        properties: {
          hex: ac.hex,
          flight: ac.flight,
          registration: ac.registration,
          aircraftType: ac.type,
          altitude: ac.altitude,
          ground_speed: ac.ground_speed,
          track: ac.track ?? 0,
          vertical_rate: ac.vertical_rate,
          squawk: ac.squawk,
          category: ac.category,
          iconImage: getIconImageName(iconType),
          color: emergency ? emergency.color : getAltitudeColor(ac.altitude),
          isEmergency: emergency ? 1 : 0,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [ac.lon, ac.lat],
        },
      };
    }),
  };
}

interface TrailPoint {
  lon: number;
  lat: number;
  altitude: number | null;
  timestamp: number;
}

const MAX_TRAIL_POINTS = 10000;
const PLAYBACK_MAX_TRAIL_POINTS = 2000;
const TRAIL_MAX_AGE_MS = 60 * 60 * 1000;

const EMPTY_FEATURE_COLLECTION: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

function findTrailStartIndex(trail: TrailPoint[], targetTime: number): number {
  let low = 0;
  let high = trail.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (trail[mid].timestamp < targetTime) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

export default function MapPage() {
  const mapRef = useRef<MapRef>(null);
  const searchParams = useSearchParams();
  const [selectedHex, setSelectedHex] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [mounted, setMounted] = useState(false);
  const [mapStyleKey, setMapStyleKey] = useState<MapStyleKey>(() => {
    if (typeof window === "undefined") return "dark";
    try {
      const stored = localStorage.getItem(MAP_STYLE_STORAGE_KEY);
      if (stored && stored in MAPBOX_STYLES) {
        return stored as MapStyleKey;
      }
    } catch {
      // Ignore storage errors
    }
    return "dark";
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const mapStyle = useMemo(() => {
    if (!mounted) return MAPBOX_STYLES.dark;
    return MAPBOX_STYLES[mapStyleKey];
  }, [mounted, mapStyleKey]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(MAP_STYLE_STORAGE_KEY, mapStyleKey);
    } catch {
      // Ignore storage errors
    }
  }, [mounted, mapStyleKey]);

  const isLightMapStyle = mapStyleKey === "light" || mapStyleKey === "streets";
  const labelTextColor = isLightMapStyle ? "#1e293b" : "#e2e8f0";
  const labelHaloColor = isLightMapStyle ? "#ffffff" : "#0f172a";

  const initializedFromUrlRef = useRef(false);
  const pendingUrlHexRef = useRef<string | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 39.8283, lng: -98.5795 });
  const mapCenterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trailsRef = useRef<Map<string, TrailPoint[]>>(new Map());
  const aircraftRef = useRef<Aircraft[]>([]);
  const pulseAnimRef = useRef<number>(0);

  const [isPlaybackMode, setIsPlaybackMode] = useState(false);
  const [playbackAircraft, setPlaybackAircraft] = useState<Aircraft[]>([]);
  const [playbackTime, setPlaybackTime] = useState<number>(0);
  const playbackTrailsRef = useRef<Map<string, TrailPoint[]>>(new Map());
  const playbackAircraftRef = useRef<Aircraft[]>([]);
  const playbackStateThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trailVersionRef = useRef(0);
  const prevAircraftHexesRef = useRef<Set<string>>(new Set());

  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [flightPositions, setFlightPositions] = useState<FlightPosition[]>([]);
  const [isLoadingFlight, setIsLoadingFlight] = useState(false);
  const [flightError, setFlightError] = useState<string | null>(null);

  const [rangeRingsCenter, setRangeRingsCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [coverageHeatmapEnabled, setCoverageHeatmapEnabled] = useState(false);
  const [airportMarkersEnabled, setAirportMarkersEnabled] = useState(false);
  const [allTrailsEnabled, setAllTrailsEnabled] = useState(false);

  useEffect(() => {
    if (initializedFromUrlRef.current) return;
    const aircraftParam = searchParams.get("aircraft");
    if (aircraftParam) {
      pendingUrlHexRef.current = aircraftParam.toUpperCase();
      setSelectedHex(pendingUrlHexRef.current);
    }
    initializedFromUrlRef.current = true;
  }, [searchParams]);

  useEffect(() => {
    if (pendingUrlHexRef.current === selectedHex) return;

    const params = new URLSearchParams(window.location.search);
    if (selectedHex) {
      params.set("aircraft", selectedHex.toUpperCase());
    } else {
      params.delete("aircraft");
    }
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  }, [selectedHex]);

  const { data: aircraftData, isLoading } = useSWR<AircraftResponse>(
    isPlaybackMode ? null : "/api/map/aircraft",
    fetcher,
    { refreshInterval: 1000 }
  );

  interface CoverageResponse {
    points: Array<{ lat: number; lon: number; count: number }>;
    maxCount: number;
  }
  const { data: coverageData } = useSWR<CoverageResponse>(
    coverageHeatmapEnabled ? "/api/map/coverage" : null,
    fetcher,
    { refreshInterval: 300000 }
  );

  const coveragePoints = useMemo(() => coverageData?.points ?? [], [coverageData?.points]);
  const coverageMaxCount = coverageData?.maxCount ?? 0;

  const liveAircraft = aircraftData?.aircraft ?? [];
  const aircraft = isPlaybackMode ? playbackAircraft : liveAircraft;
  const lastUpdateRef = useRef<number>(0);
  if (aircraftData) {
    lastUpdateRef.current = Date.now();
  }

  // Compute update status string for display (avoids Date.now() call in child component render)
  // aircraftData is intentionally in deps to trigger recompute when new data arrives
  const updateStatus = useMemo(() => {
    if (!lastUpdateRef.current) return "Connecting\u2026";
    const secondsAgo = Math.round((Date.now() - lastUpdateRef.current) / 1000);
    return `Updated ${secondsAgo}s ago`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aircraftData]);

  aircraftRef.current = aircraft;

  useEffect(() => {
    const pendingHex = pendingUrlHexRef.current;
    if (!pendingHex || !mapRef.current || aircraft.length === 0) return;

    const ac = aircraft.find((a) => a.hex.toUpperCase() === pendingHex);
    if (ac) {
      mapRef.current.flyTo({
        center: [ac.lon, ac.lat],
        zoom: Math.max(mapRef.current.getZoom(), 8),
        duration: 1000,
      });
      pendingUrlHexRef.current = null;
    }
  }, [aircraft]);

  useEffect(() => {
    if (!aircraftData) return;
    const now = Date.now();
    const trails = trailsRef.current;
    const currentHexes = new Set<string>();

    for (const ac of aircraftData.aircraft) {
      currentHexes.add(ac.hex);
      const trail = trails.get(ac.hex) || [];
      const lastPoint = trail[trail.length - 1];

      if (
        !lastPoint ||
        lastPoint.lat !== ac.lat ||
        lastPoint.lon !== ac.lon
      ) {
        trail.push({
          lon: ac.lon,
          lat: ac.lat,
          altitude: ac.altitude,
          timestamp: now,
        });

        if (trail.length > MAX_TRAIL_POINTS) {
          trail.splice(0, trail.length - MAX_TRAIL_POINTS);
        }

        trails.set(ac.hex, trail);
      }
    }

    const prevHexes = prevAircraftHexesRef.current;
    if (prevHexes.size > 0 && (trails.size > currentHexes.size || prevHexes.size > currentHexes.size)) {
      for (const hex of prevHexes) {
        if (!currentHexes.has(hex) && trails.has(hex)) {
          const trail = trails.get(hex)!;
          if (
            trail.length === 0 ||
            now - trail[trail.length - 1].timestamp > TRAIL_MAX_AGE_MS
          ) {
            trails.delete(hex);
          }
        }
      }
    }

    prevAircraftHexesRef.current = currentHexes;
  }, [aircraftData]);

  const emergencyGeojson = useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: aircraft
        .filter((ac) => getEmergencyInfo(ac.squawk) !== null)
        .map((ac) => ({
          type: "Feature" as const,
          properties: {
            emergencyColor: getEmergencyInfo(ac.squawk)!.color,
          },
          geometry: {
            type: "Point" as const,
            coordinates: [ac.lon, ac.lat],
          },
        })),
    };
  }, [aircraft]);

  const emergencyCount = emergencyGeojson.features.length;

  useEffect(() => {
    if (emergencyCount === 0) return;

    const animate = () => {
      const map = mapRef.current?.getMap();
      if (map && map.getLayer("emergency-pulse-ring")) {
        const phase = (performance.now() % 3000) / 3000;
        const radius = 12 + phase * 20;
        const opacity = 0.7 * (1 - phase);
        map.setPaintProperty("emergency-pulse-ring", "circle-radius", radius);
        map.setPaintProperty("emergency-pulse-ring", "circle-opacity", opacity);
        map.setPaintProperty("emergency-pulse-ring", "circle-stroke-opacity", Math.min(opacity + 0.2, 0.9));
      }
      pulseAnimRef.current = requestAnimationFrame(animate);
    };
    pulseAnimRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(pulseAnimRef.current);
  }, [emergencyCount]);

  const [iconsReady, setIconsReady] = useState(false);

  useEffect(() => {
    setIconsReady(false);
  }, [mapStyle]);

  useEffect(() => {
    if (iconsReady) return;
    let cancelled = false;
    const tryAddIcons = () => {
      if (cancelled) return;
      const map = mapRef.current?.getMap();
      if (!map || !map.isStyleLoaded()) {
        setTimeout(tryAddIcons, 50);
        return;
      }

      const allLoaded = AIRCRAFT_ICON_TYPES.every((t) =>
        map.hasImage(getIconImageName(t))
      );
      if (allLoaded) {
        setIconsReady(true);
        return;
      }

      const size = 48;
      for (const iconType of AIRCRAFT_ICON_TYPES) {
        const imageName = getIconImageName(iconType);
        if (!map.hasImage(imageName)) {
          const imageData = renderAircraftIcon(iconType, size);
          map.addImage(imageName, imageData, { sdf: true });
        }
      }
      setIconsReady(true);
    };
    tryAddIcons();
    return () => { cancelled = true; };
  }, [iconsReady, mapStyle]);

  const geojson = useMemo(() => buildAircraftGeojson(aircraft), [aircraft]);

  const trailGeojson = useMemo(() => {
    if (isPlaybackMode) {
      const features: GeoJSON.Feature[] = [];
      const trails = playbackTrailsRef.current;

      for (const [hex, trail] of trails.entries()) {
        if (trail.length < 2) continue;
        if (selectedHex && hex !== selectedHex) continue;

        for (let i = 0; i < trail.length - 1; i++) {
          const from = trail[i];
          const to = trail[i + 1];
          features.push({
            type: "Feature",
            properties: {
              color: getAltitudeColor(to.altitude),
            },
            geometry: {
              type: "LineString",
              coordinates: [
                [from.lon, from.lat],
                [to.lon, to.lat],
              ],
            },
          });
        }
      }

      return {
        type: "FeatureCollection" as const,
        features,
      };
    }

    if (!selectedHex) {
      return {
        type: "FeatureCollection" as const,
        features: [] as GeoJSON.Feature[],
      };
    }

    const trail = trailsRef.current.get(selectedHex);
    if (!trail || trail.length < 2) {
      return {
        type: "FeatureCollection" as const,
        features: [] as GeoJSON.Feature[],
      };
    }

    const features: GeoJSON.Feature[] = [];
    for (let i = 0; i < trail.length - 1; i++) {
      const from = trail[i];
      const to = trail[i + 1];

      features.push({
        type: "Feature",
        properties: {
          color: getAltitudeColor(to.altitude),
        },
        geometry: {
          type: "LineString",
          coordinates: [
            [from.lon, from.lat],
            [to.lon, to.lat],
          ],
        },
      });
    }

    return {
      type: "FeatureCollection" as const,
      features,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHex, aircraft, isPlaybackMode, trailVersionRef.current]);

  const allTrailsGeojson = useMemo(() => {
    if (!allTrailsEnabled || isPlaybackMode) {
      return EMPTY_FEATURE_COLLECTION;
    }

    const now = Date.now();
    const cutoffTime = now - 2 * 60 * 1000;
    const trails = trailsRef.current;
    const features: GeoJSON.Feature[] = [];

    for (const [hex, trail] of trails.entries()) {
      if (hex === selectedHex) continue;
      if (trail.length < 2) continue;

      const startIdx = findTrailStartIndex(trail, cutoffTime);
      if (startIdx >= trail.length - 1) continue;

      for (let i = startIdx; i < trail.length - 1; i++) {
        const from = trail[i];
        const to = trail[i + 1];
        features.push({
          type: "Feature",
          properties: {
            color: getAltitudeColor(to.altitude),
          },
          geometry: {
            type: "LineString",
            coordinates: [
              [from.lon, from.lat],
              [to.lon, to.lat],
            ],
          },
        });
      }
    }

    return {
      type: "FeatureCollection" as const,
      features,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTrailsEnabled, selectedHex, aircraft, isPlaybackMode]);

  const selectedAircraft = useMemo(
    () => aircraft.find((a) => a.hex === selectedHex),
    [aircraft, selectedHex]
  );

  const handleMapClick = useCallback((event: MapMouseEvent) => {
    pendingUrlHexRef.current = null;
    const features = event.features;
    if (features && features.length > 0) {
      const hex = features[0].properties?.hex;
      setSelectedHex((prev) => (prev === hex ? null : hex));
    } else {
      setSelectedHex(null);
    }
  }, []);

  const handleMoveEnd = useCallback((evt: ViewStateChangeEvent) => {
    if (mapCenterDebounceRef.current) {
      clearTimeout(mapCenterDebounceRef.current);
    }
    mapCenterDebounceRef.current = setTimeout(() => {
      setMapCenter({ lat: evt.viewState.latitude, lng: evt.viewState.longitude });
    }, 500);
  }, []);

  const handleSidebarSelect = useCallback((hex: string) => {
    pendingUrlHexRef.current = null;
    setSelectedHex(hex);
    const ac = aircraftRef.current.find((a) => a.hex === hex);
    if (ac && mapRef.current) {
      mapRef.current.flyTo({
        center: [ac.lon, ac.lat],
        zoom: Math.max(mapRef.current.getZoom(), 8),
        duration: 1000,
      });
    }
  }, []);

  const handlePlaybackUpdate = useCallback(
    (
      positions: Array<{
        hex: string;
        lat: number;
        lon: number;
        altitude: number | null;
        heading: number | null;
        speed: number | null;
        squawk: string | null;
        flight: string | null;
      }>,
      timestamp: number
    ) => {
      const mapped: Aircraft[] = positions.map((p) => ({
        hex: p.hex,
        flight: p.flight,
        registration: null,
        type: null,
        lat: p.lat,
        lon: p.lon,
        altitude: p.altitude,
        ground_speed: p.speed,
        track: p.heading,
        vertical_rate: null,
        squawk: p.squawk,
        category: null,
        seen: null,
      }));

      playbackAircraftRef.current = mapped;

      const map = mapRef.current?.getMap();
      if (map) {
        const aircraftSource = map.getSource("aircraft") as mapboxgl.GeoJSONSource | undefined;
        if (aircraftSource) {
          aircraftSource.setData(buildAircraftGeojson(mapped));
        }
      }

      if (!playbackStateThrottleRef.current) {
        playbackStateThrottleRef.current = setTimeout(() => {
          playbackStateThrottleRef.current = null;
          setPlaybackAircraft(playbackAircraftRef.current);
          setPlaybackTime(timestamp);
        }, 200);
      }

      let trailAdded = false;
      const trails = playbackTrailsRef.current;
      for (const ac of mapped) {
        const trail = trails.get(ac.hex) || [];
        const lastPoint = trail[trail.length - 1];
        if (
          !lastPoint ||
          lastPoint.lat !== ac.lat ||
          lastPoint.lon !== ac.lon
        ) {
          trail.push({
            lon: ac.lon,
            lat: ac.lat,
            altitude: ac.altitude,
            timestamp,
          });
          if (trail.length > PLAYBACK_MAX_TRAIL_POINTS) {
            trail.splice(0, trail.length - PLAYBACK_MAX_TRAIL_POINTS);
          }
          trails.set(ac.hex, trail);
          trailAdded = true;
        }
      }

      if (trailAdded) {
        trailVersionRef.current += 1;
      }
    },
    []
  );

  const handleToggleSidebar = useCallback(() => setSidebarOpen(prev => !prev), []);

  const handleClearSelection = useCallback(() => {
    pendingUrlHexRef.current = null;
    setSelectedHex(null);
  }, []);

  const handleEnterPlayback = useCallback(() => {
    setIsPlaybackMode(true);
    pendingUrlHexRef.current = null;
    setSelectedHex(null);
    playbackTrailsRef.current = new Map();
  }, []);

  const handlePlaybackEnd = useCallback(() => {
    setIsPlaybackMode(false);
    setPlaybackAircraft([]);
    setPlaybackTime(0);
    playbackTrailsRef.current = new Map();
    playbackAircraftRef.current = [];
    trailVersionRef.current = 0;
    if (playbackStateThrottleRef.current) {
      clearTimeout(playbackStateThrottleRef.current);
      playbackStateThrottleRef.current = null;
    }
    setSelectedFlightId(null);
    setFlightPositions([]);
    setFlightError(null);
  }, []);

  const handleSelectFlight = useCallback(async (flightId: string) => {
    setIsLoadingFlight(true);
    setFlightError(null);
    setSelectedFlightId(flightId);

    try {
      const response = await fetch(`/api/map/flight/${flightId}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const positions: FlightPosition[] = data.positions || [];

      if (positions.length === 0) {
        throw new Error("No position data available for this flight");
      }

      setFlightPositions(positions);

      if (mapRef.current && positions.length > 1) {
        const lngs = positions.map((p) => p.lon);
        const lats = positions.map((p) => p.lat);
        const bounds = new mapboxgl.LngLatBounds(
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)]
        );
        mapRef.current.fitBounds(bounds, {
          padding: { top: 100, bottom: 200, left: 350, right: 100 },
          duration: 1000,
        });
      }

      const snapshots = positions.map((pos) => ({
        timestamp: pos.ts,
        aircraft: [
          {
            hex: data.hex || flightId,
            lat: pos.lat,
            lon: pos.lon,
            altitude: pos.alt,
            heading: pos.hdg,
            speed: pos.spd,
            squawk: null,
            flight: data.callsign || null,
          },
        ],
      }));

      playbackTrailsRef.current = new Map();
      setIsPlaybackMode(true);
      setSelectedHex(null);

      if (positions.length > 0) {
        setPlaybackTime(positions[0].ts);
        handlePlaybackUpdate(snapshots[0].aircraft, positions[0].ts);
      }
    } catch (err) {
      setFlightError(err instanceof Error ? err.message : "Failed to load flight");
      setSelectedFlightId(null);
    } finally {
      setIsLoadingFlight(false);
    }
  }, [handlePlaybackUpdate]);

  const handleRangeRingsChange = useCallback((center: { lat: number; lng: number } | null) => {
    setRangeRingsCenter(center);
  }, []);

  const handleCoverageHeatmapChange = useCallback((enabled: boolean) => {
    setCoverageHeatmapEnabled(enabled);
  }, []);

  const handleAirportMarkersChange = useCallback((enabled: boolean) => {
    setAirportMarkersEnabled(enabled);
  }, []);

  const handleAllTrailsChange = useCallback((enabled: boolean) => {
    setAllTrailsEnabled(enabled);
  }, []);

  const handleMapStyleChange = useCallback((style: MapStyleKey) => {
    setMapStyleKey(style);
  }, []);

  const handleChartSeek = useCallback((time: number) => {
    if (flightPositions.length === 0) return;

    let bestIdx = 0;
    for (let i = 0; i < flightPositions.length; i++) {
      if (flightPositions[i].ts <= time) {
        bestIdx = i;
      } else {
        break;
      }
    }

    const pos = flightPositions[bestIdx];
    setPlaybackTime(time);

    handlePlaybackUpdate(
      [
        {
          hex: selectedFlightId || "unknown",
          lat: pos.lat,
          lon: pos.lon,
          altitude: pos.alt,
          heading: pos.hdg,
          speed: pos.spd,
          squawk: null,
          flight: null,
        },
      ],
      time
    );
  }, [flightPositions, selectedFlightId, handlePlaybackUpdate]);

  return (
    <div className="relative h-screen w-screen overflow-hidden" role="application" aria-label="Live aircraft tracking map">
      <MapGL
        ref={mapRef}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{
          latitude: 39.8283,
          longitude: -98.5795,
          zoom: 4.5,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={mapStyle}
        interactiveLayerIds={["aircraft-markers", "aircraft-markers-selected"]}
        onClick={handleMapClick}
        onMoveEnd={handleMoveEnd}
        attributionControl={false}
      >
        <CoverageHeatmap
          points={coveragePoints}
          maxCount={coverageMaxCount}
          visible={coverageHeatmapEnabled}
        />

        <AirportMarkers
          visible={airportMarkersEnabled}
          isLightMap={isLightMapStyle}
        />

        <RangeRings center={rangeRingsCenter} visible={rangeRingsCenter !== null} />

        <Source id="all-trails" type="geojson" data={allTrailsGeojson}>
          <Layer
            id="all-trails-line"
            type="line"
            layout={{
              "line-cap": "round",
              "line-join": "round",
              visibility: allTrailsEnabled ? "visible" : "none",
            }}
            paint={{
              "line-color": ["get", "color"],
              "line-width": 1.5,
              "line-opacity": 0.5,
            }}
          />
        </Source>

        <Source id="trail" type="geojson" data={trailGeojson}>
          <Layer
            id="trail-line"
            type="line"
            layout={{
              "line-cap": "round",
              "line-join": "round",
            }}
            paint={{
              "line-color": ["get", "color"],
              "line-width": 2.5,
              "line-opacity": 0.8,
            }}
          />
        </Source>

        <Source id="emergency-pulse" type="geojson" data={emergencyGeojson}>
          <Layer
            id="emergency-pulse-ring"
            type="circle"
            paint={{
              "circle-radius": 12,
              "circle-color": ["get", "emergencyColor"],
              "circle-opacity": 0.7,
              "circle-stroke-width": 2,
              "circle-stroke-color": ["get", "emergencyColor"],
              "circle-stroke-opacity": 0.9,
            }}
          />
          <Layer
            id="emergency-static-ring"
            type="circle"
            paint={{
              "circle-radius": 10,
              "circle-color": "transparent",
              "circle-stroke-width": 2,
              "circle-stroke-color": ["get", "emergencyColor"],
              "circle-stroke-opacity": 0.8,
            }}
          />
        </Source>

        <Source id="aircraft" type="geojson" data={geojson}>
          {iconsReady && (
            <Layer
              id="aircraft-markers"
              type="symbol"
              filter={selectedHex ? ["!=", ["get", "hex"], selectedHex] : ["has", "hex"]}
              layout={{
                "icon-image": ["get", "iconImage"],
                "icon-size": [
                  "case",
                  ["==", ["get", "isEmergency"], 1],
                  0.55,
                  0.4,
                ],
                "icon-rotate": ["get", "track"],
                "icon-rotation-alignment": "map",
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
                "text-field": ["get", "flight"],
                "text-size": 11,
                "text-offset": [0, 1.8],
                "text-optional": true,
                "text-allow-overlap": false,
              }}
              paint={{
                "icon-color": ["get", "color"],
                "icon-opacity": 0.9,
                "text-color": labelTextColor,
                "text-halo-color": labelHaloColor,
                "text-halo-width": 1.5,
              }}
            />
          )}
          {iconsReady && selectedHex && (
            <Layer
              id="aircraft-markers-selected"
              type="symbol"
              filter={["==", ["get", "hex"], selectedHex]}
              layout={{
                "icon-image": ["get", "iconImage"],
                "icon-size": [
                  "case",
                  ["==", ["get", "isEmergency"], 1],
                  0.75,
                  0.6,
                ],
                "icon-rotate": ["get", "track"],
                "icon-rotation-alignment": "map",
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
                "text-field": ["get", "flight"],
                "text-size": 12,
                "text-offset": [0, 2.0],
                "text-optional": true,
                "text-allow-overlap": true,
              }}
              paint={{
                "icon-color": ["get", "color"],
                "icon-opacity": 1.0,
                "text-color": isLightMapStyle ? "#0f172a" : "#ffffff",
                "text-halo-color": labelHaloColor,
                "text-halo-width": 2,
              }}
            />
          )}
          {!iconsReady && (
            <Layer
              id="aircraft-markers-fallback"
              type="symbol"
              layout={{
                "icon-image": "airport",
                "icon-size": 1.2,
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
              }}
              paint={{ "icon-opacity": 0.9 }}
            />
          )}
        </Source>
      </MapGL>

      <MapControls
        onRangeRingsChange={handleRangeRingsChange}
        onCoverageHeatmapChange={handleCoverageHeatmapChange}
        onAirportMarkersChange={handleAirportMarkersChange}
        onAllTrailsChange={handleAllTrailsChange}
        mapStyleKey={mapStyleKey}
        onMapStyleChange={handleMapStyleChange}
        offsetTop={selectedAircraft ? 300 : 0}
      />

      <AircraftSidebar
        aircraft={aircraft}
        selectedHex={selectedHex}
        onSelectAircraft={handleSidebarSelect}
        mapCenter={mapCenter}
        isOpen={sidebarOpen}
        onToggle={handleToggleSidebar}
        onSelectFlight={handleSelectFlight}
      />

      <StatsOverlay
        aircraftCount={aircraft.length}
        emergencyCount={emergencyCount}
        isPlaybackMode={isPlaybackMode}
        updateStatus={updateStatus}
        sidebarOpen={sidebarOpen}
      />

      <AltitudeLegend sidebarOpen={sidebarOpen} />

      {selectedAircraft && (
        <SelectedAircraftPanel
          aircraft={selectedAircraft}
          onClose={handleClearSelection}
        />
      )}

      <LoadingOverlay isLoading={isLoading} />

      <PlaybackControls
        onPlaybackUpdate={handlePlaybackUpdate}
        onPlaybackEnd={handlePlaybackEnd}
        isPlayback={isPlaybackMode}
        onEnterPlayback={handleEnterPlayback}
      />

      {isPlaybackMode && selectedFlightId && flightPositions.length > 0 && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 w-[min(95vw,800px)] h-40 z-10">
          <div className="bg-gray-900/95 backdrop-blur-sm rounded-lg border border-gray-700 shadow-xl p-3 h-full">
            <FlightChart
              positions={flightPositions}
              currentTime={playbackTime}
              onSeek={handleChartSeek}
            />
          </div>
        </div>
      )}

      <FlightLoadingOverlay isLoading={isLoadingFlight} />

      <FlightErrorToast error={flightError} onDismiss={() => setFlightError(null)} />

      <div className={`absolute right-4 text-xs text-gray-500 ${isPlaybackMode ? (selectedFlightId ? "bottom-[17rem]" : "bottom-24") : "bottom-8"}`}>
        HangarTrak Radar
      </div>
    </div>
  );
}
