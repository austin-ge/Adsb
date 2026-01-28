"use client";

import { useState, use, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { formatNumber } from "@/lib/format";
import {
  ArrowLeft,
  Copy,
  Check,
  Trash2,
  Settings,
  Radio,
  MapPin,
  Trophy,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  Plane,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UptimeChart } from "@/components/charts/uptime-chart";
import { RangeChart } from "@/components/charts/range-chart";

interface FeederStats {
  id: string;
  timestamp: string;
  messages: number;
  positions: number;
  aircraft: number;
  maxRange: number | null;
  avgRange: number | null;
  uptimePercent: number | null;
}

interface Feeder {
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
  // Scoring fields
  currentScore: number;
  currentRank: number | null;
  previousRank: number | null;
  // Range fields
  maxRangeNm: number | null;
  avgRangeNm24h: number | null;
}

interface Flight {
  id: string;
  hex: string;
  callsign: string | null;
  startTime: string;
  endTime: string;
  maxAltitude: number | null;
  totalDistance: number | null;
  durationSecs: number;
}

interface FlightsResponse {
  flights: Flight[];
}


function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatLastSeen(lastSeen: string | null): string {
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

function formatSoftwareType(softwareType: string | null): string | null {
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

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatFlightDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRankChangeIndicator(
  currentRank: number | null,
  previousRank: number | null
): { icon: typeof TrendingUp; color: string; label: string } | null {
  if (currentRank === null || previousRank === null) {
    return null;
  }
  if (previousRank > currentRank) {
    // Rank improved (lower is better)
    return { icon: TrendingUp, color: "text-green-500", label: "Rank improved" };
  }
  if (previousRank < currentRank) {
    // Rank dropped
    return { icon: TrendingDown, color: "text-red-500", label: "Rank dropped" };
  }
  return { icon: Minus, color: "text-gray-400", label: "Rank unchanged" };
}

export default function FeederDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const {
    data: feeder,
    error,
    mutate,
  } = useSWR<Feeder>(`/api/feeders/${resolvedParams.id}`, fetcher);

  const { data: flightsData } = useSWR<FlightsResponse>(
    feeder ? `/api/feeders/${resolvedParams.id}/flights` : null,
    fetcher
  );

  const [copiedItem, setCopiedItem] = useState<"uuid" | "command" | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLat, setEditLat] = useState("");
  const [editLng, setEditLng] = useState("");

  // Memoize reversed stats to avoid creating new arrays on each render
  const reversedStats = useMemo(() => {
    if (!feeder?.stats) return [];
    return [...feeder.stats].reverse();
  }, [feeder?.stats]);

  const handleCopyUuid = async () => {
    if (!feeder) return;
    await navigator.clipboard.writeText(feeder.uuid);
    setCopiedItem("uuid");
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const handleCopyCommand = async () => {
    if (!feeder) return;
    const command = `curl -sSL ${window.location.origin}/api/install/${feeder.uuid} | sudo bash`;
    await navigator.clipboard.writeText(command);
    setCopiedItem("command");
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const handleOpenEdit = () => {
    if (!feeder) return;
    setEditName(feeder.name);
    setEditLat(feeder.latitude?.toString() || "");
    setEditLng(feeder.longitude?.toString() || "");
    setIsEditOpen(true);
  };

  const handleUpdateFeeder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feeder) return;
    setIsUpdating(true);

    try {
      const response = await fetch(`/api/feeders/${feeder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          latitude: editLat || null,
          longitude: editLng || null,
        }),
      });

      if (response.ok) {
        mutate();
        setIsEditOpen(false);
      }
    } catch (error) {
      console.error("Failed to update feeder:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteFeeder = async () => {
    if (!feeder) return;
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/feeders/${feeder.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.push("/feeders");
      }
    } catch (error) {
      console.error("Failed to delete feeder:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <Link
          href="/feeders"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          Back to Feeders
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-red-500">Feeder not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!feeder) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-32 animate-pulse" />
        <div className="grid gap-4">
          <Card className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-muted rounded w-1/3" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-4 bg-muted rounded w-3/4" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/feeders"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          Back to Feeders
        </Link>
        <div className="flex items-center gap-2">
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" onClick={handleOpenEdit}>
                <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
                Edit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Feeder</DialogTitle>
                <DialogDescription>
                  Update your feeder&apos;s name and location.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUpdateFeeder}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-name">Feeder Name</Label>
                    <Input
                      id="edit-name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-lat">Latitude</Label>
                      <Input
                        id="edit-lat"
                        type="number"
                        step="any"
                        value={editLat}
                        onChange={(e) => setEditLat(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-lng">Longitude</Label>
                      <Input
                        id="edit-lng"
                        type="number"
                        step="any"
                        value={editLng}
                        onChange={(e) => setEditLng(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isUpdating || !editName}>
                    {isUpdating ? "Saving\u2026" : "Save Changes"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                Delete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Feeder</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete &quot;{feeder.name}&quot;? This
                  action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsDeleteOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteFeeder}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting\u2026" : "Delete Feeder"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{feeder.name}</h1>
            <Badge variant={feeder.isOnline ? "success" : "secondary"}>
              {feeder.isOnline ? "Online" : "Offline"}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Registered {formatDate(feeder.createdAt)}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
              Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">{feeder.currentScore}</p>
              {feeder.currentRank !== null && (
                <span className="text-sm text-muted-foreground">
                  #{feeder.currentRank}
                </span>
              )}
              {(() => {
                const rankChange = getRankChangeIndicator(
                  feeder.currentRank,
                  feeder.previousRank
                );
                if (!rankChange) return null;
                const ChangeIcon = rankChange.icon;
                return (
                  <ChangeIcon
                    className={`h-4 w-4 ${rankChange.color}`}
                    aria-label={rankChange.label}
                  />
                );
              })()}
            </div>
          </CardContent>
        </Card>
        {(feeder.latitude !== null && feeder.longitude !== null) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" aria-hidden="true" />
                Range
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col">
                <p className="text-2xl font-bold">
                  {feeder.maxRangeNm !== null
                    ? `${feeder.maxRangeNm.toFixed(1)} nm`
                    : "--"}
                </p>
                <span className="text-xs text-muted-foreground">
                  Avg 24h:{" "}
                  {feeder.avgRangeNm24h !== null
                    ? `${feeder.avgRangeNm24h.toFixed(1)} nm`
                    : "--"}
                </span>
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatNumber(feeder.messagesTotal)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Positions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatNumber(feeder.positionsTotal)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Aircraft Seen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{feeder.aircraftSeen}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Last Seen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatLastSeen(feeder.lastSeen)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Feeder Details */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5" aria-hidden="true" />
              Feeder Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Feeder UUID</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="bg-muted px-2 py-1 rounded text-sm flex-1 overflow-hidden text-ellipsis">
                  {feeder.uuid}
                </code>
                <Button size="sm" variant="ghost" onClick={handleCopyUuid} aria-label="Copy UUID">
                  {copiedItem === "uuid" ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            {formatSoftwareType(feeder.softwareType) && (
              <div>
                <Label className="text-muted-foreground">Software</Label>
                <p className="mt-1">{formatSoftwareType(feeder.softwareType)}</p>
              </div>
            )}
            {(feeder.latitude || feeder.longitude) && (
              <div>
                <Label className="text-muted-foreground">Location</Label>
                <div className="flex items-center gap-2 mt-1">
                  <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span>
                    {feeder.latitude?.toFixed(4)}, {feeder.longitude?.toFixed(4)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Setup Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Run this command on your Raspberry Pi to configure your feeder:
            </p>
            <div className="relative">
              <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
                curl -sSL {typeof window !== "undefined" ? window.location.origin : ""}/api/install/{feeder.uuid} | sudo bash
              </pre>
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-1 right-1"
                onClick={handleCopyCommand}
                aria-label="Copy install command"
              >
                {copiedItem === "command" ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The script will automatically configure your readsb or ultrafeeder
              installation to feed data to our network.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      {feeder.stats && feeder.stats.length > 0 && (
        <div
          className={`grid gap-6 ${
            feeder.latitude !== null && feeder.longitude !== null
              ? "md:grid-cols-2"
              : "md:grid-cols-1"
          }`}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base">7-Day Uptime</CardTitle>
            </CardHeader>
            <CardContent>
              <UptimeChart
                data={reversedStats.map((stat) => ({
                  timestamp: stat.timestamp,
                  uptimePercent: stat.uptimePercent,
                }))}
              />
            </CardContent>
          </Card>
          {feeder.latitude !== null && feeder.longitude !== null && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Range History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <RangeChart
                    data={reversedStats.map((stat) => ({
                      timestamp: stat.timestamp,
                      maxRange: stat.maxRange,
                      avgRange: stat.avgRange,
                    }))}
                    unit="nm"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Recent Flights Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5" aria-hidden="true" />
            Recent Flights
          </CardTitle>
        </CardHeader>
        <CardContent>
          {flightsData?.flights && flightsData.flights.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">
                      Callsign
                    </th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">
                      Hex
                    </th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">
                      Date
                    </th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">
                      Duration
                    </th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">
                      Max Alt
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {flightsData.flights.map((flight) => (
                    <tr
                      key={flight.id}
                      className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="py-2 px-2 font-mono">
                        {flight.callsign || "--"}
                      </td>
                      <td className="py-2 px-2 font-mono text-muted-foreground">
                        {flight.hex.toUpperCase()}
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">
                        {formatFlightDate(flight.endTime)}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {formatDuration(flight.durationSecs)}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {flight.maxAltitude !== null
                          ? `${flight.maxAltitude.toLocaleString()} ft`
                          : "--"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No flight data yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Historical Stats */}
      {feeder.stats && feeder.stats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {feeder.stats.slice(0, 10).map((stat) => (
                <div
                  key={stat.id}
                  className="flex items-center justify-between text-sm py-2 border-b last:border-0"
                >
                  <span className="text-muted-foreground">
                    {new Date(stat.timestamp).toLocaleString()}
                  </span>
                  <div className="flex gap-4">
                    <span>{stat.messages.toLocaleString()} msgs</span>
                    <span>{stat.positions.toLocaleString()} pos</span>
                    <span>{stat.aircraft} aircraft</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
