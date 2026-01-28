"use client";

import { useCallback, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { formatNumber } from "@/lib/format";
import {
  Trophy,
  Medal,
  Award,
  Radio,
  ArrowLeft,
  Search,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  owner: string;
  messagesTotal?: string;
  positionsTotal?: string;
  messages?: number;
  positions?: number;
  aircraft?: number;
  aircraftSeen?: number;
  isOnline: boolean;
  lastSeen: string | null;
  memberSince: string;
  // Phase 7 fields
  score: number | null;
  maxRange: number | null;
  avgRange: number | null;
  storedRank: number | null;
  rankChange: number | null;
}

interface LeaderboardResponse {
  period: string;
  sortBy: string;
  search?: string;
  leaderboard: LeaderboardEntry[];
}

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) {
    return <Trophy className="h-6 w-6 text-yellow-500" aria-hidden="true" />;
  }
  if (rank === 2) {
    return <Medal className="h-6 w-6 text-gray-400" aria-hidden="true" />;
  }
  if (rank === 3) {
    return <Award className="h-6 w-6 text-amber-600" aria-hidden="true" />;
  }
  return (
    <span className="h-6 w-6 flex items-center justify-center text-muted-foreground font-bold">
      {rank}
    </span>
  );
}

function RankChangeIndicator({ change }: { change: number | null }) {
  if (change === null || change === 0) {
    return null;
  }

  if (change > 0) {
    return (
      <span
        className="inline-flex items-center gap-0.5 text-green-500 text-xs font-medium"
        title={`Up ${change} position${change > 1 ? "s" : ""}`}
      >
        <TrendingUp className="h-3 w-3" aria-hidden="true" />
        <span className="sr-only">Up {change}</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-0.5 text-red-500 text-xs font-medium"
      title={`Down ${Math.abs(change)} position${Math.abs(change) > 1 ? "s" : ""}`}
    >
      <TrendingDown className="h-3 w-3" aria-hidden="true" />
      <span className="sr-only">Down {Math.abs(change)}</span>
    </span>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-muted-foreground">--</span>;
  }

  // Color based on score tier
  let colorClass = "bg-gray-500/20 text-gray-300 border-gray-500/30";
  if (score >= 90) {
    colorClass = "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
  } else if (score >= 70) {
    colorClass = "bg-green-500/20 text-green-300 border-green-500/30";
  } else if (score >= 50) {
    colorClass = "bg-blue-500/20 text-blue-300 border-blue-500/30";
  }

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-md text-xs font-bold border ${colorClass}`}
    >
      {score}
    </span>
  );
}

function formatRange(nm: number | null): string {
  if (nm === null) return "--";
  return `${Math.round(nm)} nm`;
}

export default function LeaderboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const period = searchParams.get("period") || "all";
  const sortBy = searchParams.get("sort") || "score";
  const searchQuery = searchParams.get("search") || "";

  // Local state for debounced search
  const [searchInput, setSearchInput] = useState(searchQuery);

  // Sync local input with URL param when URL changes externally
  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  // Debounce search input
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchInput !== searchQuery) {
        const params = new URLSearchParams(searchParams.toString());
        if (searchInput.trim()) {
          params.set("search", searchInput.trim());
        } else {
          params.delete("search");
        }
        router.replace(`?${params.toString()}`);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchInput, searchQuery, searchParams, router]);

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(key, value);
      router.replace(`?${params.toString()}`);
    },
    [searchParams, router]
  );

  // Build API URL with search param
  const apiUrl = useMemo(() => {
    const params = new URLSearchParams({
      period,
      sort: sortBy,
      limit: "25",
    });
    if (searchQuery.trim()) {
      params.set("search", searchQuery.trim());
    }
    return `/api/leaderboard?${params.toString()}`;
  }, [period, sortBy, searchQuery]);

  const { data, error, isLoading } = useSWR<LeaderboardResponse>(
    apiUrl,
    fetcher,
    { refreshInterval: 60000 } // Refresh every minute
  );

  const periods = [
    { value: "all", label: "All Time" },
    { value: "month", label: "This Month" },
    { value: "week", label: "This Week" },
    { value: "day", label: "Today" },
  ];

  const sortOptions = [
    { value: "score", label: "Score" },
    { value: "aircraft", label: "Aircraft" },
    { value: "messages", label: "Messages" },
    { value: "maxRange", label: "Max Range" },
    { value: "avgRange", label: "Avg Range" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to Home
            </Link>
            <Link href="/login">
              <Button variant="outline">Sign In</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Title */}
          <div className="text-center">
            <h1 className="text-3xl font-bold flex items-center justify-center gap-3 text-balance">
              <Trophy className="h-8 w-8 text-yellow-500" aria-hidden="true" />
              Feeder Leaderboard
            </h1>
            <p className="text-muted-foreground mt-2">
              Top contributors to our ADS-B network
            </p>
          </div>

          {/* Search and Filters */}
          <div className="space-y-4">
            {/* Search Input */}
            <div className="relative max-w-md mx-auto">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                placeholder="Search feeders by name..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10"
                aria-label="Search feeders"
              />
            </div>

            {/* Period and Sort Filters */}
            <div className="flex flex-wrap gap-4 justify-center">
              <div className="flex gap-1 bg-muted p-1 rounded-lg" role="group" aria-label="Time period">
                {periods.map((p) => (
                  <Button
                    key={p.value}
                    variant={period === p.value ? "default" : "ghost"}
                    size="sm"
                    onClick={() => updateParams("period", p.value)}
                    aria-pressed={period === p.value}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
              <div className="flex gap-1 bg-muted p-1 rounded-lg" role="group" aria-label="Sort by">
                {sortOptions.map((s) => (
                  <Button
                    key={s.value}
                    variant={sortBy === s.value ? "default" : "ghost"}
                    size="sm"
                    onClick={() => updateParams("sort", s.value)}
                    aria-pressed={sortBy === s.value}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Leaderboard */}
          {error ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-red-500">Failed to load leaderboard</p>
              </CardContent>
            </Card>
          ) : isLoading ? (
            <Card>
              <CardContent className="py-12">
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="h-16 bg-muted rounded-lg animate-pulse"
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : data?.leaderboard.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Radio
                  className="h-12 w-12 text-muted-foreground mx-auto mb-4"
                  aria-hidden="true"
                />
                {searchQuery ? (
                  <>
                    <h3 className="text-lg font-semibold">No feeders found</h3>
                    <p className="text-muted-foreground mt-2">
                      No feeders match &ldquo;{searchQuery}&rdquo;
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setSearchInput("")}
                    >
                      Clear Search
                    </Button>
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-semibold">No feeders yet</h3>
                    <p className="text-muted-foreground mt-2">
                      Be the first to contribute to our network!
                    </p>
                    <Link href="/register">
                      <Button className="mt-4">Get Started</Button>
                    </Link>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>
                    Top 25 Feeders - {periods.find((p) => p.value === period)?.label}
                  </span>
                  {searchQuery && (
                    <span className="text-sm font-normal text-muted-foreground">
                      Showing results for &ldquo;{searchQuery}&rdquo;
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Table Header - Desktop */}
                <div className="hidden lg:grid lg:grid-cols-[3rem_1fr_4rem_5rem_5rem_5rem_5rem_5rem] gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b mb-2">
                  <div>Rank</div>
                  <div>Feeder</div>
                  <div className="text-center">Score</div>
                  <div className="text-right">Messages</div>
                  <div className="text-right">Positions</div>
                  <div className="text-right">Aircraft</div>
                  <div className="text-right">Max Range</div>
                  <div className="text-right">Status</div>
                </div>

                <div className="space-y-2">
                  {data?.leaderboard.map((entry) => {
                    const messages =
                      entry.messagesTotal || entry.messages?.toString() || "0";
                    const positions =
                      entry.positionsTotal || entry.positions?.toString() || "0";
                    const aircraft = entry.aircraftSeen || entry.aircraft || 0;

                    return (
                      <div
                        key={entry.id}
                        className={`flex items-center gap-4 p-4 rounded-lg transition-colors ${
                          entry.rank <= 3
                            ? "bg-muted/50"
                            : "hover:bg-muted/30"
                        }`}
                      >
                        {/* Rank with change indicator */}
                        <div className="flex items-center gap-1 w-12 shrink-0">
                          <RankIcon rank={entry.rank} />
                          <RankChangeIndicator change={entry.rankChange} />
                        </div>

                        {/* Feeder info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold truncate">
                              {entry.name}
                            </span>
                            {/* Mobile: Show status badge inline */}
                            <Badge
                              variant={entry.isOnline ? "success" : "secondary"}
                              className="text-xs lg:hidden"
                            >
                              {entry.isOnline ? "Online" : "Offline"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            by {entry.owner}
                          </p>
                        </div>

                        {/* Score - Always visible */}
                        <div className="shrink-0">
                          <ScoreBadge score={entry.score} />
                        </div>

                        {/* Desktop: Full stats grid */}
                        <div className="hidden lg:grid lg:grid-cols-[5rem_5rem_5rem_5rem_5rem] gap-4 text-sm">
                          <div className="text-right">
                            <p className="font-semibold">
                              {formatNumber(messages)}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              messages
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">
                              {formatNumber(positions)}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              positions
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{aircraft}</p>
                            <p className="text-muted-foreground text-xs">
                              aircraft
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">
                              {formatRange(entry.maxRange)}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              max range
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge
                              variant={entry.isOnline ? "success" : "secondary"}
                              className="text-xs"
                            >
                              {entry.isOnline ? "Online" : "Offline"}
                            </Badge>
                          </div>
                        </div>

                        {/* Tablet: Condensed stats */}
                        <div className="hidden sm:flex lg:hidden gap-6 text-sm">
                          <div className="text-right">
                            <p className="font-semibold">
                              {formatNumber(messages)}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              messages
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{aircraft}</p>
                            <p className="text-muted-foreground text-xs">
                              aircraft
                            </p>
                          </div>
                        </div>

                        {/* Mobile: Minimal stats */}
                        <div className="sm:hidden text-right">
                          <p className="font-semibold">
                            {formatNumber(messages)}
                          </p>
                          <p className="text-muted-foreground text-xs">msgs</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* CTA */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-8 text-center">
              <h3 className="text-xl font-semibold">
                Want to see your name on the leaderboard?
              </h3>
              <p className="text-muted-foreground mt-2">
                Register your Raspberry Pi feeder and start contributing to our
                network today.
              </p>
              <Link href="/register">
                <Button className="mt-4">Register Now</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
