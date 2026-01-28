import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface FeederStats {
  id: string;
  timestamp: string;
  messages: number;
  positions: number;
  aircraft: number;
  maxRange: number | null;
  avgRange: number | null;
  uptimePercent: number | null;
}

export interface Feeder {
  id: string;
  uuid: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  softwareType: string | null;
  messagesTotal: string;
  positionsTotal: string;
  aircraftSeen: number;
  lastSeen: string | null;
  isOnline: boolean;
  createdAt: string;
  updatedAt: string;
  stats: FeederStats[];
  currentScore: number;
  currentRank: number | null;
  previousRank: number | null;
  maxRangeNm: number | null;
  avgRangeNm24h: number | null;
}

export interface Flight {
  id: string;
  hex: string;
  callsign: string | null;
  startTime: string;
  endTime: string;
  maxAltitude: number | null;
  totalDistance: number | null;
  durationSecs: number;
}

export interface DailyStats {
  date: string;
  dateKey: string;
  messages: number;
  positions: number;
  aircraft: number;
  avgScore: number;
  uptimePercent: number;
  isToday: boolean;
}

export interface NearbyAirport {
  icao: string;
  name: string;
  distance: number;
}

export interface MonthlySummary {
  totalMessages: number;
  totalPositions: number;
  maxAircraft: number;
  avgUptime: number;
  daysActive: number;
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatLastSeen(lastSeen: string | null): string {
  if (!lastSeen) return "Never";
  const date = new Date(lastSeen);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minutes ago`;
  if (hours < 24) return `${hours} hours ago`;
  if (days < 7) return `${days} days ago`;
  return formatDate(lastSeen);
}

export function formatSoftwareType(softwareType: string | null): string | null {
  if (!softwareType) return null;
  const softwareNames: Record<string, string> = {
    ultrafeeder: "adsb.im / Ultrafeeder",
    piaware: "PiAware",
    fr24: "FlightRadar24",
    readsb: "readsb",
    "dump1090-fa": "dump1090-fa",
    "dump1090-mutability": "dump1090-mutability",
  };
  return softwareNames[softwareType] || softwareType;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function formatFlightDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getRankChangeIndicator(
  currentRank: number | null,
  previousRank: number | null
): { icon: typeof TrendingUp; color: string; label: string } | null {
  if (currentRank === null || previousRank === null) {
    return null;
  }
  if (previousRank > currentRank) {
    return { icon: TrendingUp, color: "text-green-500", label: "Rank improved" };
  }
  if (previousRank < currentRank) {
    return { icon: TrendingDown, color: "text-red-500", label: "Rank dropped" };
  }
  return { icon: Minus, color: "text-gray-400", label: "Rank unchanged" };
}
