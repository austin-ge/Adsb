"use client";

import useSWR from "swr";
import { useSession } from "@/lib/auth-client";
import { Radio, Plane, Signal, Clock, Trophy, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface Feeder {
  id: string;
  name: string;
  isOnline: boolean;
  messagesTotal: string;
  lastSeen: string | null;
}

interface NetworkStats {
  network: {
    totalFeeders: number;
    onlineFeeders: number;
    messagesTotal: string;
    aircraftTracked: number;
  };
  live: {
    aircraft: number;
  };
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function formatNumber(num: string | number): string {
  const n = typeof num === "string" ? parseInt(num, 10) : num;
  if (isNaN(n)) return "0";
  if (n >= 1000000000) return (n / 1000000000).toFixed(2) + "B";
  if (n >= 1000000) return (n / 1000000).toFixed(2) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toLocaleString();
}

function formatLastSeen(lastSeen: string | null): string {
  if (!lastSeen) return "Never";
  const diff = Date.now() - new Date(lastSeen).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const { data: feeders } = useSWR<Feeder[]>("/api/feeders", fetcher);
  const { data: stats } = useSWR<NetworkStats>("/api/stats", fetcher, {
    refreshInterval: 30000,
  });

  const onlineFeeders = feeders?.filter((f) => f.isOnline).length || 0;
  const totalFeeders = feeders?.length || 0;
  const totalMessages = feeders?.reduce(
    (acc, f) => acc + parseInt(f.messagesTotal || "0"),
    0
  ) || 0;

  const apiTierDisplay = {
    FREE: { label: "FREE", limit: "100 req/min" },
    FEEDER: { label: "FEEDER", limit: "1,000 req/min" },
    PRO: { label: "PRO", limit: "10,000 req/min" },
  };

  // Get user's tier - default to FREE
  const userTier = "FREE" as keyof typeof apiTierDisplay;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {session?.user?.name || "User"}
        </p>
      </div>

      {/* User Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Feeders</CardTitle>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{onlineFeeders}</div>
            <p className="text-xs text-muted-foreground">
              of {totalFeeders} online
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Messages</CardTitle>
            <Signal className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalMessages)}</div>
            <p className="text-xs text-muted-foreground">total contributed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Live Aircraft</CardTitle>
            <Plane className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.live.aircraft || 0}
            </div>
            <p className="text-xs text-muted-foreground">on the network</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Tier</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {apiTierDisplay[userTier].label}
            </div>
            <p className="text-xs text-muted-foreground">
              {apiTierDisplay[userTier].limit}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Network Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Network Feeders</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.network.onlineFeeders || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              of {stats?.network.totalFeeders || 0} total feeders
            </p>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Network Messages</CardTitle>
            <Signal className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(stats?.network.messagesTotal || "0")}
            </div>
            <p className="text-xs text-muted-foreground">all time</p>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aircraft Tracked</CardTitle>
            <Plane className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(stats?.network.aircraftTracked || 0)}
            </div>
            <p className="text-xs text-muted-foreground">unique aircraft</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* My Feeders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>My Feeders</CardTitle>
            <Button size="sm" asChild>
              <Link href="/feeders">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!feeders || feeders.length === 0 ? (
              <div className="text-center py-8">
                <Radio className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">No feeders yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Register a feeder to start contributing ADS-B data
                </p>
                <Button className="mt-4" asChild>
                  <Link href="/feeders">Add Feeder</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {feeders.slice(0, 5).map((feeder) => (
                  <Link
                    key={feeder.id}
                    href={`/feeders/${feeder.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Radio
                        className={`h-4 w-4 ${
                          feeder.isOnline ? "text-green-500" : "text-muted-foreground"
                        }`}
                      />
                      <div>
                        <p className="font-medium">{feeder.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatNumber(feeder.messagesTotal)} messages
                        </p>
                      </div>
                    </div>
                    <Badge variant={feeder.isOnline ? "success" : "secondary"}>
                      {feeder.isOnline ? "Online" : formatLastSeen(feeder.lastSeen)}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/feeders">
                <Radio className="mr-2 h-4 w-4" />
                Register a new feeder
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/api-keys">
                <Signal className="mr-2 h-4 w-4" />
                Generate API key
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/stats">
                <TrendingUp className="mr-2 h-4 w-4" />
                View network statistics
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/leaderboard">
                <Trophy className="mr-2 h-4 w-4" />
                View leaderboard
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link
                href={process.env.NEXT_PUBLIC_MAP_URL || "/map"}
                target="_blank"
              >
                <Plane className="mr-2 h-4 w-4" />
                View live map
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
