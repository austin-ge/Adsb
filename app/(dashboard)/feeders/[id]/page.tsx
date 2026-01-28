"use client";

import { useState, use, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { haversineDistanceNm } from "@/lib/geo";
import {
  FeederHeader,
  FeederStatsGrid,
  FeederDetails,
  SetupInstructions,
  FeederCharts,
  NearbyAirports,
  RecentFlights,
  DailyStatsTable,
} from "@/components/feeder";
import type {
  Feeder,
  Flight,
  DailyStats,
  NearbyAirport,
  MonthlySummary,
} from "@/components/feeder";

interface Airport {
  icao: string;
  iata: string;
  name: string;
  lat: number;
  lon: number;
}

interface FlightsResponse {
  flights: Flight[];
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

  const { data: airports } = useSWR<Airport[]>(
    feeder?.latitude && feeder?.longitude ? "/data/airports.json" : null,
    fetcher
  );

  const [copiedItem, setCopiedItem] = useState<"uuid" | "command" | "share" | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLat, setEditLat] = useState("");
  const [editLng, setEditLng] = useState("");

  // Aggregate hourly stats into 7 daily buckets
  const dailyStats = useMemo((): DailyStats[] => {
    if (!feeder?.stats || feeder.stats.length === 0) return [];

    const today = new Date().toLocaleDateString(undefined, { dateStyle: "short" });
    const buckets: Record<string, { messages: number; positions: number; aircraftMax: number; scores: number[]; hoursWithData: number }> = {};

    for (const stat of feeder.stats) {
      const date = new Date(stat.timestamp);
      const dateKey = date.toLocaleDateString(undefined, { dateStyle: "short" });

      if (!buckets[dateKey]) {
        buckets[dateKey] = { messages: 0, positions: 0, aircraftMax: 0, scores: [], hoursWithData: 0 };
      }

      buckets[dateKey].messages += stat.messages;
      buckets[dateKey].positions += stat.positions;
      buckets[dateKey].aircraftMax = Math.max(buckets[dateKey].aircraftMax, stat.aircraft);
      if (stat.uptimePercent !== null) {
        buckets[dateKey].scores.push(stat.uptimePercent);
      }
      buckets[dateKey].hoursWithData += 1;
    }

    const result: DailyStats[] = Object.entries(buckets)
      .map(([dateKey, data]) => ({
        date: dateKey,
        dateKey,
        messages: data.messages,
        positions: data.positions,
        aircraft: data.aircraftMax,
        avgScore: data.scores.length > 0
          ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
          : 0,
        uptimePercent: Math.round((data.hoursWithData / 24) * 100),
        isToday: dateKey === today,
      }))
      .sort((a, b) => {
        const dateA = new Date(a.dateKey);
        const dateB = new Date(b.dateKey);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 7);

    return result;
  }, [feeder?.stats]);

  // Calculate nearby airports
  const nearbyAirports = useMemo((): NearbyAirport[] => {
    if (!feeder?.latitude || !feeder?.longitude || !airports) return [];

    const feederLat = feeder.latitude;
    const feederLon = feeder.longitude;

    return airports
      .map((airport) => ({
        icao: airport.icao,
        name: airport.name,
        distance: haversineDistanceNm(feederLat, feederLon, airport.lat, airport.lon),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);
  }, [feeder?.latitude, feeder?.longitude, airports]);

  // Monthly summary stats
  const monthlySummary = useMemo((): MonthlySummary | null => {
    if (!feeder?.stats || feeder.stats.length === 0) return null;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthStats = feeder.stats.filter((stat) => {
      const statDate = new Date(stat.timestamp);
      return statDate.getMonth() === currentMonth && statDate.getFullYear() === currentYear;
    });

    if (monthStats.length === 0) return null;

    const totalMessages = monthStats.reduce((sum, s) => sum + s.messages, 0);
    const totalPositions = monthStats.reduce((sum, s) => sum + s.positions, 0);
    const maxAircraft = Math.max(...monthStats.map((s) => s.aircraft));
    const uptimeScores = monthStats.filter((s) => s.uptimePercent !== null).map((s) => s.uptimePercent!);
    const avgUptime = uptimeScores.length > 0
      ? Math.round(uptimeScores.reduce((a, b) => a + b, 0) / uptimeScores.length)
      : 0;
    const uniqueDays = new Set(monthStats.map((s) => new Date(s.timestamp).toDateString())).size;

    return {
      totalMessages,
      totalPositions,
      maxAircraft,
      avgUptime,
      daysActive: uniqueDays,
    };
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

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopiedItem("share");
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
            <CardContent className="py-12">
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
      <FeederHeader
        feeder={feeder}
        copiedItem={copiedItem}
        isEditOpen={isEditOpen}
        isDeleteOpen={isDeleteOpen}
        isUpdating={isUpdating}
        isDeleting={isDeleting}
        editName={editName}
        editLat={editLat}
        editLng={editLng}
        onShare={handleShare}
        onOpenEdit={handleOpenEdit}
        onEditOpenChange={setIsEditOpen}
        onDeleteOpenChange={setIsDeleteOpen}
        onEditNameChange={setEditName}
        onEditLatChange={setEditLat}
        onEditLngChange={setEditLng}
        onUpdateFeeder={handleUpdateFeeder}
        onDeleteFeeder={handleDeleteFeeder}
      />

      <FeederStatsGrid feeder={feeder} monthlySummary={monthlySummary} />

      <div className="grid md:grid-cols-2 gap-6">
        <FeederDetails
          feeder={feeder}
          copiedItem={copiedItem}
          onCopyUuid={handleCopyUuid}
        />
        <SetupInstructions
          feederUuid={feeder.uuid}
          copiedItem={copiedItem}
          onCopyCommand={handleCopyCommand}
        />
      </div>

      <FeederCharts
        stats={feeder.stats}
        hasLocation={feeder.latitude !== null && feeder.longitude !== null}
      />

      <NearbyAirports airports={nearbyAirports} />

      <RecentFlights flights={flightsData?.flights} />

      <DailyStatsTable stats={dailyStats} />
    </div>
  );
}
