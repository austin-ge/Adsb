"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapGL, { Layer, Source, MapRef, MapMouseEvent, ViewStateChangeEvent } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  Aircraft,
  AircraftResponse,
  formatAltitude,
  formatSpeed,
  formatVerticalRate,
  getAltitudeColor,
  getEmergencyInfo,
} from "./types";
import { AircraftSidebar } from "./aircraft-sidebar";

interface TrailPoint {
  lon: number;
  lat: number;
  altitude: number | null;
  timestamp: number;
}

const MAX_TRAIL_POINTS = 10000; // Keep full flight path
const TRAIL_MAX_AGE_MS = 60 * 60 * 1000; // Clean up after 1 hour of no updates

export default function MapPage() {
  const mapRef = useRef<MapRef>(null);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [selectedHex, setSelectedHex] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [pulsePhase, setPulsePhase] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mapCenter, setMapCenter] = useState({ lat: 39.8283, lng: -98.5795 });
  const trailsRef = useRef<Map<string, TrailPoint[]>>(new Map());

  const fetchAircraft = useCallback(async () => {
    try {
      const res = await fetch("/api/map/aircraft");
      if (res.ok) {
        const data: AircraftResponse = await res.json();
        const now = Date.now();

        // Update trails for all aircraft
        const trails = trailsRef.current;
        const seenHexes = new Set<string>();

        for (const ac of data.aircraft) {
          seenHexes.add(ac.hex);
          const trail = trails.get(ac.hex) || [];
          const lastPoint = trail[trail.length - 1];

          // Only add point if position changed
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

            // Trim to max points
            if (trail.length > MAX_TRAIL_POINTS) {
              trail.splice(0, trail.length - MAX_TRAIL_POINTS);
            }

            trails.set(ac.hex, trail);
          }
        }

        // Clean up stale trails (aircraft no longer visible)
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

        setAircraft(data.aircraft);
        setLastUpdate(now);
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Failed to fetch aircraft:", err);
    }
  }, []);

  useEffect(() => {
    fetchAircraft();
    const interval = setInterval(fetchAircraft, 1000);
    return () => clearInterval(interval);
  }, [fetchAircraft]);

  // Pulse animation for emergency aircraft rings
  useEffect(() => {
    const interval = setInterval(() => {
      setPulsePhase((prev) => (prev + 1) % 60);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Load aircraft icon when map loads
  const onMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    // Create aircraft icon (triangle/arrow shape)
    const size = 48;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw aircraft shape pointing up
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(size / 2, 4); // Nose
    ctx.lineTo(size - 8, size - 8); // Right wing
    ctx.lineTo(size / 2, size - 14); // Tail center
    ctx.lineTo(8, size - 8); // Left wing
    ctx.closePath();
    ctx.fill();

    map.addImage("aircraft-icon", {
      width: size,
      height: size,
      data: ctx.getImageData(0, 0, size, size).data,
    } as unknown as ImageData);
  }, []);

  // Build GeoJSON from aircraft data
  const geojson = useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: aircraft.map((ac) => {
        const emergency = getEmergencyInfo(ac.squawk);
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
            color: emergency ? emergency.color : getAltitudeColor(ac.altitude),
            isSelected: ac.hex === selectedHex ? 1 : 0,
            isEmergency: emergency ? 1 : 0,
          },
          geometry: {
            type: "Point" as const,
            coordinates: [ac.lon, ac.lat],
          },
        };
      }),
    };
  }, [aircraft, selectedHex]);

  // Build GeoJSON for emergency aircraft pulse rings
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

  const pulseProgress = (pulsePhase % 60) / 60;
  const pulseRadius = 12 + pulseProgress * 20;
  const pulseOpacity = 0.7 * (1 - pulseProgress);

  const emergencyCount = useMemo(
    () => aircraft.filter((ac) => getEmergencyInfo(ac.squawk) !== null).length,
    [aircraft]
  );

  // Build trail GeoJSON for selected aircraft
  const trailGeojson = useMemo(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHex, aircraft]); // aircraft triggers recompute on each update

  const selectedAircraft = useMemo(
    () => aircraft.find((a) => a.hex === selectedHex),
    [aircraft, selectedHex]
  );

  const handleMapClick = useCallback(
    (event: MapMouseEvent) => {
      const features = event.features;
      if (features && features.length > 0) {
        const hex = features[0].properties?.hex;
        setSelectedHex(hex === selectedHex ? null : hex);
      } else {
        setSelectedHex(null);
      }
    },
    [selectedHex]
  );

  const handleMoveEnd = useCallback((evt: ViewStateChangeEvent) => {
    setMapCenter({ lat: evt.viewState.latitude, lng: evt.viewState.longitude });
  }, []);

  const handleSidebarSelect = useCallback((hex: string) => {
    setSelectedHex(hex);
    const ac = aircraft.find((a) => a.hex === hex);
    if (ac && mapRef.current) {
      mapRef.current.flyTo({
        center: [ac.lon, ac.lat],
        zoom: Math.max(mapRef.current.getZoom(), 8),
        duration: 1000,
      });
    }
  }, [aircraft]);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <MapGL
        ref={mapRef}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{
          latitude: 39.8283,
          longitude: -98.5795,
          zoom: 4.5,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        interactiveLayerIds={["aircraft-markers"]}
        onClick={handleMapClick}
        onLoad={onMapLoad}
        onMoveEnd={handleMoveEnd}
        attributionControl={false}
      >
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
              "circle-radius": pulseRadius,
              "circle-color": ["get", "emergencyColor"],
              "circle-opacity": pulseOpacity,
              "circle-stroke-width": 2,
              "circle-stroke-color": ["get", "emergencyColor"],
              "circle-stroke-opacity": Math.min(pulseOpacity + 0.2, 0.9),
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
          {/* Aircraft icons */}
          <Layer
            id="aircraft-markers"
            type="symbol"
            layout={{
              "icon-image": "aircraft-icon",
              "icon-size": [
                "case",
                ["all", ["==", ["get", "isSelected"], 1], ["==", ["get", "isEmergency"], 1]],
                0.75,
                ["==", ["get", "isSelected"], 1],
                0.6,
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
              "text-color": "#e2e8f0",
              "text-halo-color": "#0f172a",
              "text-halo-width": 1.5,
            }}
          />
        </Source>
      </MapGL>

      {/* Aircraft list sidebar */}
      <AircraftSidebar
        aircraft={aircraft}
        selectedHex={selectedHex}
        onSelectAircraft={handleSidebarSelect}
        mapCenter={mapCenter}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Stats overlay - top left */}
      <div className={`absolute top-4 bg-gray-900/90 backdrop-blur-sm rounded-lg px-3 py-2 text-sm text-gray-200 font-mono transition-[left] duration-200 ${sidebarOpen ? "left-[21rem]" : "left-4"} hidden md:block`}>
        <div className="flex items-center gap-3">
          <span>{aircraft.length} aircraft</span>
          {emergencyCount > 0 && (
            <>
              <span className="text-gray-500">|</span>
              <span className="text-red-400 font-bold animate-pulse">
                {emergencyCount} emergency
              </span>
            </>
          )}
          <span className="text-gray-500">|</span>
          <span className="text-gray-400">
            {lastUpdate
              ? `Updated ${Math.round((Date.now() - lastUpdate) / 1000)}s ago`
              : "Connecting..."}
          </span>
        </div>
      </div>

      {/* Stats overlay - mobile (always left-4) */}
      <div className="absolute top-4 left-4 bg-gray-900/90 backdrop-blur-sm rounded-lg px-3 py-2 text-sm text-gray-200 font-mono md:hidden">
        <div className="flex items-center gap-3">
          <span>{aircraft.length} aircraft</span>
          {emergencyCount > 0 && (
            <>
              <span className="text-gray-500">|</span>
              <span className="text-red-400 font-bold animate-pulse">
                {emergencyCount} emergency
              </span>
            </>
          )}
        </div>
      </div>

      {/* Altitude legend - bottom left */}
      <div className={`absolute bottom-8 bg-gray-900/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-gray-300 transition-[left] duration-200 ${sidebarOpen ? "md:left-[21rem]" : "left-4"} left-4`}>
        <div className="font-semibold mb-1 text-gray-100">Altitude</div>
        <div className="flex flex-col gap-0.5">
          {[
            { color: "#22c55e", label: "0 – 2,000 ft" },
            { color: "#84cc16", label: "2,000 – 5,000 ft" },
            { color: "#eab308", label: "5,000 – 10,000 ft" },
            { color: "#f97316", label: "10,000 – 20,000 ft" },
            { color: "#ef4444", label: "20,000 – 30,000 ft" },
            { color: "#a855f7", label: "30,000 – 40,000 ft" },
            { color: "#6366f1", label: "40,000+ ft" },
          ].map(({ color, label }) => (
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
              onClick={() => setSelectedHex(null)}
              className="text-gray-400 hover:text-white text-xl leading-none"
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
            Loading aircraft data...
          </div>
        </div>
      )}

      {/* Branding - bottom right */}
      <div className="absolute bottom-8 right-4 text-xs text-gray-500">
        HangarTrak Radar
      </div>
    </div>
  );
}
