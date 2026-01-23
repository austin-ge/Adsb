"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { formatNumber } from "@/lib/format";
import { Trophy, Medal, Award, Radio, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
}

interface LeaderboardResponse {
  period: string;
  sortBy: string;
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

export default function LeaderboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const period = searchParams.get("period") || "all";
  const sortBy = searchParams.get("sort") || "messages";

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(key, value);
      router.replace(`?${params.toString()}`);
    },
    [searchParams, router]
  );

  const { data, error, isLoading } = useSWR<LeaderboardResponse>(
    `/api/leaderboard?period=${period}&sort=${sortBy}&limit=25`,
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
    { value: "messages", label: "Messages" },
    { value: "positions", label: "Positions" },
    { value: "aircraft", label: "Aircraft" },
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
        <div className="max-w-4xl mx-auto space-y-8">
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

          {/* Filters */}
          <div className="flex flex-wrap gap-4 justify-center">
            <div className="flex gap-1 bg-muted p-1 rounded-lg">
              {periods.map((p) => (
                <Button
                  key={p.value}
                  variant={period === p.value ? "default" : "ghost"}
                  size="sm"
                  onClick={() => updateParams("period", p.value)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="flex gap-1 bg-muted p-1 rounded-lg">
              {sortOptions.map((s) => (
                <Button
                  key={s.value}
                  variant={sortBy === s.value ? "default" : "ghost"}
                  size="sm"
                  onClick={() => updateParams("sort", s.value)}
                >
                  {s.label}
                </Button>
              ))}
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
                <Radio className="h-12 w-12 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
                <h3 className="text-lg font-semibold">No feeders yet</h3>
                <p className="text-muted-foreground mt-2">
                  Be the first to contribute to our network!
                </p>
                <Link href="/register">
                  <Button className="mt-4">Get Started</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Top 25 Feeders - {periods.find((p) => p.value === period)?.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
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
                        <RankIcon rank={entry.rank} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold truncate">
                              {entry.name}
                            </span>
                            <Badge
                              variant={entry.isOnline ? "success" : "secondary"}
                              className="text-xs"
                            >
                              {entry.isOnline ? "Online" : "Offline"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            by {entry.owner}
                          </p>
                        </div>
                        <div className="hidden sm:flex gap-6 text-sm">
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
                        </div>
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
