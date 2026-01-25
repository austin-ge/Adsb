"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
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
import { useUnits, getAltitudeRanges } from "@/lib/units";

// Mapbox styles for light and dark themes
const MAPBOX_STYLES = {
  dark: "mapbox://styles/mapbox/dark-v11",
  light: "mapbox://styles/mapbox/light-v11",
} as const;
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

const MAX_TRAIL_POINTS = 10000; // Keep full flight path
const PLAYBACK_MAX_TRAIL_POINTS = 2000; // Reduced limit during playback to prevent memory issues
const TRAIL_MAX_AGE_MS = 60 * 60 * 1000; // Clean up after 1 hour of no updates

export default function MapPage() {
  const mapRef = useRef<MapRef>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedHex, setSelectedHex] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Units context for formatting
  const { units, formatAltitude, formatSpeed, formatVerticalRate } = useUnits();

  // Theme management for map style
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Track mount state to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Get the appropriate map style based on theme
  const mapStyle = useMemo(() => {
    if (!mounted) return MAPBOX_STYLES.dark; // Default during SSR
    return resolvedTheme === "light" ? MAPBOX_STYLES.light : MAPBOX_STYLES.dark;
  }, [mounted, resolvedTheme]);

  // Text colors that work on both light and dark map styles
  const labelTextColor = resolvedTheme === "light" ? "#1e293b" : "#e2e8f0";
  const labelHaloColor = resolvedTheme === "light" ? "#ffffff" : "#0f172a";

  // Track whether we have initialized from URL (prevents re-centering on every data update)
  const initializedFromUrlRef = useRef(false);
  const pendingUrlHexRef = useRef<string | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 39.8283, lng: -98.5795 });
  const mapCenterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trailsRef = useRef<Map<string, TrailPoint[]>>(new Map());
  const aircraftRef = useRef<Aircraft[]>([]);
  const pulseAnimRef = useRef<number>(0);

  // Playback mode state
  const [isPlaybackMode, setIsPlaybackMode] = useState(false);
  const [playbackAircraft, setPlaybackAircraft] = useState<Aircraft[]>([]);
  const [playbackTime, setPlaybackTime] = useState<number>(0);
  const playbackTrailsRef = useRef<Map<string, TrailPoint[]>>(new Map());
  const playbackAircraftRef = useRef<Aircraft[]>([]);
  const playbackStateThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trailVersionRef = useRef(0);

  // Flight replay state (for individual flight playback from search)
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [flightPositions, setFlightPositions] = useState<FlightPosition[]>([]);
  const [isLoadingFlight, setIsLoadingFlight] = useState(false);
  const [flightError, setFlightError] = useState<string | null>(null);

  // Range rings state
  const [rangeRingsCenter, setRangeRingsCenter] = useState<{ lat: number; lng: number } | null>(null);

  // Coverage heatmap state
  const [coverageHeatmapEnabled, setCoverageHeatmapEnabled] = useState(false);

  // Initialize selectedHex from URL on mount (only once)
  useEffect(() => {
    if (initializedFromUrlRef.current) return;
    const aircraftParam = searchParams.get("aircraft");
    if (aircraftParam) {
      // Store the pending hex - we will select and center on it once data loads
      pendingUrlHexRef.current = aircraftParam.toUpperCase();
      setSelectedHex(pendingUrlHexRef.current);
    }
    initializedFromUrlRef.current = true;
  }, [searchParams]);

  // Sync URL when selectedHex changes (shallow routing, no full page reload)
  useEffect(() => {
    // Skip URL update during initial load from URL param
    if (pendingUrlHexRef.current === selectedHex) return;

    const params = new URLSearchParams(searchParams.toString());
    if (selectedHex) {
      params.set("aircraft", selectedHex.toUpperCase());
    } else {
      params.delete("aircraft");
    }
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    router.replace(newUrl, { scroll: false });
  }, [selectedHex, searchParams, router]);

  // Use SWR for aircraft polling with 1-second refresh (paused during playback)
  const { data: aircraftData, isLoading } = useSWR<AircraftResponse>(
    isPlaybackMode ? null : "/api/map/aircraft",
    fetcher,
    { refreshInterval: 1000 }
  );

  // Fetch coverage data only when heatmap is enabled (refresh every 5 minutes)
  interface CoverageResponse {
    points: Array<{ lat: number; lon: number; count: number }>;
    maxCount: number;
  }
  const { data: coverageData } = useSWR<CoverageResponse>(
    coverageHeatmapEnabled ? "/api/map/coverage" : null,
    fetcher,
    { refreshInterval: 300000 } // 5 minutes
  );

  // In playback mode, use playback aircraft data; otherwise use live data
  const liveAircraft = aircraftData?.aircraft ?? [];
  const aircraft = isPlaybackMode ? playbackAircraft : liveAircraft;
  const lastUpdate = aircraftData ? Date.now() : 0;

  // Keep aircraft ref in sync for stable callbacks
  aircraftRef.current = aircraft;

  // Auto-center on aircraft from URL parameter once data loads
  useEffect(() => {
    const pendingHex = pendingUrlHexRef.current;
    if (!pendingHex || !mapRef.current || aircraft.length === 0) return;

    const ac = aircraft.find((a) => a.hex.toUpperCase() === pendingHex);
    if (ac) {
      // Found the aircraft - center the map on it
      mapRef.current.flyTo({
        center: [ac.lon, ac.lat],
        zoom: Math.max(mapRef.current.getZoom(), 8),
        duration: 1000,
      });
      // Clear pending so we do not re-center on subsequent data updates
      pendingUrlHexRef.current = null;
    }
    // If aircraft not found, keep pendingHex set in case it appears later
  }, [aircraft]);

  // Update trails when aircraft data changes
  useEffect(() => {
    if (!aircraftData) return;
    const now = Date.now();
    const trails = trailsRef.current;
    const seenHexes = new Set<string>();

    for (const ac of aircraftData.aircraft) {
      seenHexes.add(ac.hex);
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

    for (const hex of trails.keys()) {
      if (!seenHexes.has(hex)) {
        const trail = trails.get(hex)!;
        if (
          trail.length === 0 ||
          now - trail[trail.length - 1].timestamp > TRAIL_MAX_AGE_MS
        ) {
          trails.delete(hex);
        }
      }
    }
  }, [aircraftData]);

  // Build GeoJSON for emergency aircraft pulse rings (moved above pulse animation)
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

  // Derive count directly from the already-computed emergencyGeojson (no separate filter pass)
  const emergencyCount = emergencyGeojson.features.length;

  // Pulse animation via Mapbox API (no React re-renders) - only runs when emergencies exist
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

  // Track when all aircraft type icons have been added to the map
  const [iconsReady, setIconsReady] = useState(false);

  // Reset icons ready state when map style changes (theme switch)
  useEffect(() => {
    setIconsReady(false);
  }, [mapStyle]);

  // Poll for map readiness and register all aircraft type icons
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

      // Check if all icons already loaded (e.g. after style reload)
      const allLoaded = AIRCRAFT_ICON_TYPES.every((t) =>
        map.hasImage(getIconImageName(t))
      );
      if (allLoaded) {
        setIconsReady(true);
        return;
      }

      // Render and register each aircraft type icon as an SDF image
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

  // Build GeoJSON from aircraft data (selectedHex excluded to avoid rebuild on click)
  const geojson = useMemo(() => buildAircraftGeojson(aircraft), [aircraft]);

  // Build trail GeoJSON for selected aircraft (live or playback mode)
  const trailGeojson = useMemo(() => {
    // In playback mode, show trails for all aircraft
    if (isPlaybackMode) {
      const features: GeoJSON.Feature[] = [];
      const trails = playbackTrailsRef.current;

      for (const [hex, trail] of trails.entries()) {
        if (trail.length < 2) continue;
        // Only show trail for selected aircraft, or all if none selected
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

    // Live mode: show trail for selected aircraft only
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

    // Create line segments colored by altitude
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
    // trailVersionRef.current is used instead of playbackTime to avoid per-frame recomputation.
    // It only increments when a new trail point is actually added (see handlePlaybackUpdate).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHex, aircraft, isPlaybackMode, trailVersionRef.current]);

  const selectedAircraft = useMemo(
    () => aircraft.find((a) => a.hex === selectedHex),
    [aircraft, selectedHex]
  );

  const handleMapClick = useCallback((event: MapMouseEvent) => {
    // Clear pending URL ref so URL sync works for manual interactions
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
    // Debounce map center state updates to avoid re-renders on every pan
    if (mapCenterDebounceRef.current) {
      clearTimeout(mapCenterDebounceRef.current);
    }
    mapCenterDebounceRef.current = setTimeout(() => {
      setMapCenter({ lat: evt.viewState.latitude, lng: evt.viewState.longitude });
    }, 500);
  }, []);

  const handleSidebarSelect = useCallback((hex: string) => {
    // Clear pending URL ref so URL sync works for manual interactions
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

  // Playback callbacks - updates Mapbox source directly to avoid React re-renders at 60fps.
  // React state is updated at a throttled rate (every 200ms) for UI displays only.
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
      // Convert playback positions to Aircraft format
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

      // Store in ref for immediate access (no React re-render)
      playbackAircraftRef.current = mapped;

      // Update the Mapbox source directly for smooth 60fps rendering
      const map = mapRef.current?.getMap();
      if (map) {
        const aircraftSource = map.getSource("aircraft") as mapboxgl.GeoJSONSource | undefined;
        if (aircraftSource) {
          aircraftSource.setData(buildAircraftGeojson(mapped));
        }
      }

      // Throttle React state updates to ~5fps (every 200ms) for UI elements
      if (!playbackStateThrottleRef.current) {
        playbackStateThrottleRef.current = setTimeout(() => {
          playbackStateThrottleRef.current = null;
          setPlaybackAircraft(playbackAircraftRef.current);
          setPlaybackTime(timestamp);
        }, 200);
      }

      // Build trails during playback
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

      // Only increment trail version when new points are actually added
      // This triggers trailGeojson recompute only when needed, not every frame
      if (trailAdded) {
        trailVersionRef.current += 1;
      }
    },
    []
  );

  const handleToggleSidebar = useCallback(() => setSidebarOpen(prev => !prev), []);

  // Handler for closing the selected aircraft panel (clears URL param too)
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
    // Also clear flight replay state
    setSelectedFlightId(null);
    setFlightPositions([]);
    setFlightError(null);
  }, []);

  // Handle flight selection from search - load flight track and start playback
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

      // Auto-fit map bounds to flight track
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

      // Convert positions to playback format and trigger playback mode
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

      // Enter playback mode with this flight's data
      // We'll simulate the playback by setting initial state
      playbackTrailsRef.current = new Map();
      setIsPlaybackMode(true);
      setSelectedHex(null);

      // Set initial playback time to start of flight
      if (positions.length > 0) {
        setPlaybackTime(positions[0].ts);
        // Update with first position
        handlePlaybackUpdate(snapshots[0].aircraft, positions[0].ts);
      }
    } catch (err) {
      setFlightError(err instanceof Error ? err.message : "Failed to load flight");
      setSelectedFlightId(null);
    } finally {
      setIsLoadingFlight(false);
    }
  }, [handlePlaybackUpdate]);

  // Handle range rings center change from map controls
  const handleRangeRingsChange = useCallback((center: { lat: number; lng: number } | null) => {
    setRangeRingsCenter(center);
  }, []);

  // Handle coverage heatmap toggle from map controls
  const handleCoverageHeatmapChange = useCallback((enabled: boolean) => {
    setCoverageHeatmapEnabled(enabled);
  }, []);

  // Handle chart seek - update playback to specific time
  const handleChartSeek = useCallback((time: number) => {
    if (flightPositions.length === 0) return;

    // Find the position at or before this time
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

    // Update playback with interpolated position
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
        {/* Coverage heatmap layer - rendered below everything else */}
        <CoverageHeatmap
          points={coverageData?.points ?? []}
          maxCount={coverageData?.maxCount ?? 0}
          visible={coverageHeatmapEnabled}
        />

        {/* Range rings layer - rendered below aircraft */}
        <RangeRings center={rangeRingsCenter} visible={rangeRingsCenter !== null} />

        {/* Flight trail for selected aircraft */}
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

        {/* Emergency aircraft pulse rings */}
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
                "text-color": resolvedTheme === "light" ? "#0f172a" : "#ffffff",
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

      {/* Map controls panel - positioned below selected aircraft panel when shown */}
      <MapControls
        onRangeRingsChange={handleRangeRingsChange}
        onCoverageHeatmapChange={handleCoverageHeatmapChange}
        offsetTop={selectedAircraft ? 300 : 0}
      />

      {/* Aircraft list sidebar */}
      <AircraftSidebar
        aircraft={aircraft}
        selectedHex={selectedHex}
        onSelectAircraft={handleSidebarSelect}
        mapCenter={mapCenter}
        isOpen={sidebarOpen}
        onToggle={handleToggleSidebar}
        onSelectFlight={handleSelectFlight}
      />

      {/* Stats overlay - top left */}
      <div className={`absolute top-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200 font-mono tabular-nums transition-[left] duration-200 border border-gray-200 dark:border-transparent shadow-lg dark:shadow-none ${sidebarOpen ? "left-[21rem]" : "left-4"} hidden md:block`} role="status" aria-live="polite" aria-atomic="true">
        <div className="flex items-center gap-3">
          <span>{aircraft.length} aircraft</span>
          {emergencyCount > 0 && (
            <>
              <span className="text-gray-400 dark:text-gray-500">|</span>
              <span className="text-red-600 dark:text-red-400 font-bold animate-pulse">
                {emergencyCount} emergency
              </span>
            </>
          )}
          <span className="text-gray-400 dark:text-gray-500">|</span>
          {isPlaybackMode ? (
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              PLAYBACK
            </span>
          ) : (
            <span className="text-gray-500 dark:text-gray-400">
              {lastUpdate
                ? `Updated ${Math.round((Date.now() - lastUpdate) / 1000)}s ago`
                : "Connecting\u2026"}
            </span>
          )}
        </div>
      </div>

      {/* Stats overlay - mobile (always left-4) */}
      <div className="absolute top-4 left-4 bg-gray-900/90 backdrop-blur-sm rounded-lg px-3 py-2 text-sm text-gray-200 font-mono tabular-nums md:hidden">
        <div className="flex items-center gap-3">
          <span>{aircraft.length} aircraft</span>
          {isPlaybackMode ? (
            <>
              <span className="text-gray-500">|</span>
              <span className="text-amber-400 font-medium">PLAYBACK</span>
            </>
          ) : emergencyCount > 0 ? (
            <>
              <span className="text-gray-500">|</span>
              <span className="text-red-400 font-bold animate-pulse">
                {emergencyCount} emergency
              </span>
            </>
          ) : null}
        </div>
      </div>

      {/* Altitude legend - bottom left */}
      <div className={`absolute bottom-8 bg-gray-900/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-gray-300 transition-[left] duration-200 ${sidebarOpen ? "md:left-[21rem]" : "left-4"} left-4`}>
        <div className="font-semibold mb-1 text-gray-100">Altitude</div>
        <div className="flex flex-col gap-0.5">
          {getAltitudeRanges(units).map(({ color, label }) => (
            <div key={color} className="flex items-center gap-2">
              <div
                className="w-3 h-2 rounded-sm"
                style={{ backgroundColor: color }}
              />
              <span>{label}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-700 mt-2 pt-2">
          <div className="font-semibold mb-1 text-gray-100">Emergency</div>
          <div className="flex flex-col gap-0.5">
            {[
              { color: "#ff0000", code: "7500", label: "Hijack" },
              { color: "#ff8c00", code: "7600", label: "Radio failure" },
              { color: "#ff0000", code: "7700", label: "Emergency" },
            ].map(({ color, code, label }) => (
              <div key={code} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full animate-pulse"
                  style={{ backgroundColor: color }}
                />
                <span>{code} – {label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Selected aircraft panel - top right */}
      {selectedAircraft && (
        <div className="absolute top-4 right-4 w-72 bg-gray-900/95 backdrop-blur-sm rounded-lg border border-gray-700 shadow-xl overflow-hidden">
          {getEmergencyInfo(selectedAircraft.squawk) && (
            <div
              className="px-4 py-2 text-center text-white font-bold text-sm animate-pulse"
              style={{ backgroundColor: getEmergencyInfo(selectedAircraft.squawk)!.color }}
            >
              {getEmergencyInfo(selectedAircraft.squawk)!.label} (SQUAWK {selectedAircraft.squawk})
              <div className="text-xs font-normal opacity-90">
                {getEmergencyInfo(selectedAircraft.squawk)!.description}
              </div>
            </div>
          )}
          <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
            <div>
              <div className="text-white font-bold text-lg">
                {selectedAircraft.flight || selectedAircraft.hex.toUpperCase()}
              </div>
              {selectedAircraft.registration && (
                <div className="text-gray-400 text-sm">
                  {selectedAircraft.registration}
                  {selectedAircraft.type && ` · ${selectedAircraft.type}`}
                </div>
              )}
            </div>
            <button
              onClick={handleClearSelection}
              className="text-gray-400 hover:text-white text-xl leading-none"
              aria-label="Close aircraft details"
            >
              &times;
            </button>
          </div>
          <div className="px-4 py-3 space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-gray-500 text-xs uppercase">Altitude</div>
                <div className="text-white font-medium">
                  {formatAltitude(selectedAircraft.altitude)}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-xs uppercase">Speed</div>
                <div className="text-white font-medium">
                  {formatSpeed(selectedAircraft.ground_speed)}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-xs uppercase">
                  Vertical Rate
                </div>
                <div className="text-white font-medium">
                  {formatVerticalRate(selectedAircraft.vertical_rate)}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-xs uppercase">Heading</div>
                <div className="text-white font-medium">
                  {selectedAircraft.track !== null
                    ? `${Math.round(selectedAircraft.track)}°`
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-xs uppercase">Squawk</div>
                <div className={`font-medium ${
                  getEmergencyInfo(selectedAircraft.squawk)
                    ? "text-red-400 font-bold"
                    : "text-white"
                }`}>
                  {selectedAircraft.squawk || "—"}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-xs uppercase">ICAO</div>
                <div className="text-white font-medium font-mono">
                  {selectedAircraft.hex.toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
          <div className="text-white text-lg font-medium animate-pulse">
            Loading aircraft data\u2026
          </div>
        </div>
      )}

      {/* Playback controls */}
      <PlaybackControls
        onPlaybackUpdate={handlePlaybackUpdate}
        onPlaybackEnd={handlePlaybackEnd}
        isPlayback={isPlaybackMode}
        onEnterPlayback={handleEnterPlayback}
      />

      {/* Flight chart panel - shown during flight replay */}
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

      {/* Flight loading overlay */}
      {isLoadingFlight && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-30">
          <div className="bg-gray-800 rounded-lg px-6 py-4 shadow-xl border border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-white text-sm font-medium">Loading flight data...</span>
            </div>
          </div>
        </div>
      )}

      {/* Flight error toast */}
      {flightError && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30">
          <div className="bg-red-900/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-xl border border-red-700">
            <div className="flex items-center gap-2">
              <span className="text-red-200 text-sm">{flightError}</span>
              <button
                onClick={() => setFlightError(null)}
                className="text-red-300 hover:text-white ml-2"
                aria-label="Dismiss error"
              >
                &times;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branding - bottom right (shift up when playback controls visible) */}
      <div className={`absolute right-4 text-xs text-gray-500 ${isPlaybackMode ? (selectedFlightId ? "bottom-[17rem]" : "bottom-24") : "bottom-8"}`}>
        HangarTrak Radar
      </div>
    </div>
  );
}
