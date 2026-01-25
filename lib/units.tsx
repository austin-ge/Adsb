"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * Unit systems supported by the map
 * - imperial: feet, knots, nautical miles, ft/min (aviation standard)
 * - metric: meters, km/h, kilometers, m/s
 */
export type UnitSystem = "imperial" | "metric";

const STORAGE_KEY = "hangartrak-units";

// Conversion constants
const FEET_TO_METERS = 0.3048;
const KNOTS_TO_KMH = 1.852;
const KNOTS_TO_MS = 0.514444;
const NM_TO_KM = 1.852;
const FPM_TO_MS = 0.00508; // feet per minute to meters per second

interface UnitsContextValue {
  units: UnitSystem;
  setUnits: (units: UnitSystem) => void;
  toggleUnits: () => void;

  // Conversion functions - raw values
  convertAltitude: (feet: number | null) => number | null;
  convertSpeed: (knots: number | null) => number | null;
  convertDistance: (nm: number) => number;
  convertVerticalRate: (fpm: number | null) => number | null;

  // Formatting functions - return strings with units
  formatAltitude: (feet: number | null) => string;
  formatSpeed: (knots: number | null) => string;
  formatDistance: (nm: number) => string;
  formatDistanceShort: (nm: number) => string;
  formatVerticalRate: (fpm: number | null) => string;

  // Unit labels
  altitudeUnit: string;
  altitudeUnitShort: string;
  speedUnit: string;
  speedUnitShort: string;
  distanceUnit: string;
  distanceUnitShort: string;
  verticalRateUnit: string;
  verticalRateUnitShort: string;
}

const UnitsContext = createContext<UnitsContextValue | null>(null);

function loadStoredUnits(): UnitSystem {
  if (typeof window === "undefined") return "imperial";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "metric" || stored === "imperial") {
      return stored;
    }
  } catch {
    // Ignore storage errors
  }
  return "imperial"; // Default to imperial (aviation standard)
}

function saveUnits(units: UnitSystem) {
  try {
    localStorage.setItem(STORAGE_KEY, units);
  } catch {
    // Ignore storage errors
  }
}

export function UnitsProvider({ children }: { children: ReactNode }) {
  // Initialize with stored value on client, imperial on server
  // Since the map page uses ssr: false, this will always run on client
  const [units, setUnitsState] = useState<UnitSystem>(() => {
    // This runs only once during initial render
    // On server, typeof window is undefined so we return imperial
    if (typeof window === "undefined") return "imperial";
    return loadStoredUnits();
  });

  const setUnits = useCallback((newUnits: UnitSystem) => {
    setUnitsState(newUnits);
    saveUnits(newUnits);
  }, []);

  const toggleUnits = useCallback(() => {
    setUnitsState((prev) => {
      const next = prev === "imperial" ? "metric" : "imperial";
      saveUnits(next);
      return next;
    });
  }, []);

  // Conversion functions
  const convertAltitude = useCallback(
    (feet: number | null): number | null => {
      if (feet === null) return null;
      return units === "imperial" ? feet : Math.round(feet * FEET_TO_METERS);
    },
    [units]
  );

  const convertSpeed = useCallback(
    (knots: number | null): number | null => {
      if (knots === null) return null;
      return units === "imperial" ? knots : Math.round(knots * KNOTS_TO_KMH);
    },
    [units]
  );

  const convertDistance = useCallback(
    (nm: number): number => {
      return units === "imperial" ? nm : nm * NM_TO_KM;
    },
    [units]
  );

  const convertVerticalRate = useCallback(
    (fpm: number | null): number | null => {
      if (fpm === null) return null;
      return units === "imperial" ? fpm : fpm * FPM_TO_MS;
    },
    [units]
  );

  // Formatting functions
  const formatAltitude = useCallback(
    (feet: number | null): string => {
      if (feet === null) return "\u2014"; // em dash
      if (units === "imperial") {
        // Use flight levels above 18,000 ft (standard aviation)
        if (feet >= 18000) return `FL${Math.round(feet / 100)}`;
        return `${feet.toLocaleString()} ft`;
      }
      const meters = Math.round(feet * FEET_TO_METERS);
      return `${meters.toLocaleString()} m`;
    },
    [units]
  );

  const formatSpeed = useCallback(
    (knots: number | null): string => {
      if (knots === null) return "\u2014";
      if (units === "imperial") {
        return `${Math.round(knots)} kts`;
      }
      const kmh = Math.round(knots * KNOTS_TO_KMH);
      return `${kmh} km/h`;
    },
    [units]
  );

  const formatDistance = useCallback(
    (nm: number): string => {
      if (units === "imperial") {
        return `${nm.toFixed(1)} nm`;
      }
      const km = nm * NM_TO_KM;
      return `${km.toFixed(1)} km`;
    },
    [units]
  );

  const formatDistanceShort = useCallback(
    (nm: number): string => {
      if (units === "imperial") {
        return `${Math.round(nm)} nm`;
      }
      const km = nm * NM_TO_KM;
      return `${Math.round(km)} km`;
    },
    [units]
  );

  const formatVerticalRate = useCallback(
    (fpm: number | null): string => {
      if (fpm === null) return "\u2014";
      const arrow = fpm > 0 ? "\u2191" : fpm < 0 ? "\u2193" : "\u2192"; // up, down, right arrows
      if (units === "imperial") {
        return `${arrow} ${Math.abs(fpm).toLocaleString()} fpm`;
      }
      const ms = fpm * FPM_TO_MS;
      return `${arrow} ${Math.abs(ms).toFixed(1)} m/s`;
    },
    [units]
  );

  // Memoize the context value to prevent unnecessary re-renders in consumers
  // All callbacks are already memoized with useCallback, so we only depend on `units`
  const value: UnitsContextValue = useMemo(
    () => ({
      units,
      setUnits,
      toggleUnits,
      convertAltitude,
      convertSpeed,
      convertDistance,
      convertVerticalRate,
      formatAltitude,
      formatSpeed,
      formatDistance,
      formatDistanceShort,
      formatVerticalRate,
      // Unit labels - derived directly from units
      altitudeUnit: units === "imperial" ? "feet" : "meters",
      altitudeUnitShort: units === "imperial" ? "ft" : "m",
      speedUnit: units === "imperial" ? "knots" : "km/h",
      speedUnitShort: units === "imperial" ? "kts" : "km/h",
      distanceUnit: units === "imperial" ? "nautical miles" : "kilometers",
      distanceUnitShort: units === "imperial" ? "nm" : "km",
      verticalRateUnit: units === "imperial" ? "feet per minute" : "meters per second",
      verticalRateUnitShort: units === "imperial" ? "fpm" : "m/s",
    }),
    [
      units,
      setUnits,
      toggleUnits,
      convertAltitude,
      convertSpeed,
      convertDistance,
      convertVerticalRate,
      formatAltitude,
      formatSpeed,
      formatDistance,
      formatDistanceShort,
      formatVerticalRate,
    ]
  );

  return <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>;
}

export function useUnits(): UnitsContextValue {
  const context = useContext(UnitsContext);
  if (!context) {
    throw new Error("useUnits must be used within a UnitsProvider");
  }
  return context;
}

// Standalone conversion constants for non-React usage
export const UNIT_CONVERSIONS = {
  FEET_TO_METERS,
  KNOTS_TO_KMH,
  KNOTS_TO_MS,
  NM_TO_KM,
  FPM_TO_MS,
} as const;

// Altitude ranges for legend (in feet, will be converted based on unit system)
export const ALTITUDE_RANGES_IMPERIAL = [
  { color: "#22c55e", min: 0, max: 2000, label: "0 - 2,000 ft" },
  { color: "#84cc16", min: 2000, max: 5000, label: "2,000 - 5,000 ft" },
  { color: "#eab308", min: 5000, max: 10000, label: "5,000 - 10,000 ft" },
  { color: "#f97316", min: 10000, max: 20000, label: "10,000 - 20,000 ft" },
  { color: "#ef4444", min: 20000, max: 30000, label: "20,000 - 30,000 ft" },
  { color: "#a855f7", min: 30000, max: 40000, label: "30,000 - 40,000 ft" },
  { color: "#6366f1", min: 40000, max: Infinity, label: "40,000+ ft" },
];

export const ALTITUDE_RANGES_METRIC = [
  { color: "#22c55e", min: 0, max: 610, label: "0 - 610 m" },
  { color: "#84cc16", min: 610, max: 1524, label: "610 - 1,524 m" },
  { color: "#eab308", min: 1524, max: 3048, label: "1,524 - 3,048 m" },
  { color: "#f97316", min: 3048, max: 6096, label: "3,048 - 6,096 m" },
  { color: "#ef4444", min: 6096, max: 9144, label: "6,096 - 9,144 m" },
  { color: "#a855f7", min: 9144, max: 12192, label: "9,144 - 12,192 m" },
  { color: "#6366f1", min: 12192, max: Infinity, label: "12,192+ m" },
];

export function getAltitudeRanges(units: UnitSystem) {
  return units === "imperial" ? ALTITUDE_RANGES_IMPERIAL : ALTITUDE_RANGES_METRIC;
}

// Range ring distances - will be converted based on unit system
export const RANGE_DISTANCES_IMPERIAL = [25, 50, 100, 150, 200]; // nautical miles
export const RANGE_DISTANCES_METRIC = [50, 100, 200, 300, 400]; // kilometers (approximate equivalents)

export function getRangeDistances(units: UnitSystem) {
  return units === "imperial" ? RANGE_DISTANCES_IMPERIAL : RANGE_DISTANCES_METRIC;
}

export function formatRangeLabel(distance: number, units: UnitSystem): string {
  return units === "imperial" ? `${distance}nm` : `${distance}km`;
}
