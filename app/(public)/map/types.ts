export interface Aircraft {
  hex: string;
  flight: string | null;
  registration: string | null;
  type: string | null;
  lat: number;
  lon: number;
  altitude: number | null;
  ground_speed: number | null;
  track: number | null;
  vertical_rate: number | null;
  squawk: string | null;
  category: string | null;
  seen: number | null;
}

export interface AircraftResponse {
  now: number;
  total: number;
  aircraft: Aircraft[];
}

export interface EmergencyInfo {
  label: string;
  color: string;
  description: string;
}

export const EMERGENCY_SQUAWKS: Record<string, EmergencyInfo> = {
  "7500": { label: "HIJACK", color: "#ff0000", description: "Unlawful interference" },
  "7600": { label: "RADIO FAILURE", color: "#ff8c00", description: "Lost communications" },
  "7700": { label: "EMERGENCY", color: "#ff0000", description: "General emergency" },
};

export function getAltitudeColor(altitude: number | null): string {
  if (altitude === null) return "#888888";
  if (altitude <= 0) return "#00ff00";
  if (altitude <= 2000) return "#22c55e";
  if (altitude <= 5000) return "#84cc16";
  if (altitude <= 10000) return "#eab308";
  if (altitude <= 20000) return "#f97316";
  if (altitude <= 30000) return "#ef4444";
  if (altitude <= 40000) return "#a855f7";
  return "#6366f1";
}

export function formatAltitude(alt: number | null): string {
  if (alt === null) return "—";
  if (alt >= 18000) return `FL${Math.round(alt / 100)}`;
  return `${alt.toLocaleString()} ft`;
}

export function formatSpeed(speed: number | null): string {
  if (speed === null) return "—";
  return `${Math.round(speed)} kts`;
}

export function formatVerticalRate(rate: number | null): string {
  if (rate === null) return "—";
  const arrow = rate > 0 ? "↑" : rate < 0 ? "↓" : "→";
  return `${arrow} ${Math.abs(rate).toLocaleString()} fpm`;
}

export function getEmergencyInfo(squawk: string | null): EmergencyInfo | null {
  if (!squawk) return null;
  return EMERGENCY_SQUAWKS[squawk] || null;
}

/** Haversine distance in nautical miles */
export function getDistanceNm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3440.065; // Earth radius in nautical miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
