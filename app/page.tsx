"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  Plane,
  Radio,
  BarChart3,
  Key,
  Activity,
  Globe,
  Users,
  Zap,
  ArrowRight,
  MapPin,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetcher } from "@/lib/fetcher";

interface NetworkStats {
  network: {
    feeders: {
      total: number;
      online: number;
    };
    messages_total: string;
    positions_total: string;
    aircraft_tracked: number;
  };
  live: {
    aircraft: number;
    aircraft_with_position: number;
    message_rate: number;
    timestamp: number;
  };
}

function AnimatedNumber({
  value,
  suffix = "",
  duration = 1500,
}: {
  value: number;
  suffix?: string;
  duration?: number;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const previousValue = useRef(0);

  useEffect(() => {
    const startValue = previousValue.current;
    const endValue = value;
    const startTime = performance.now();

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.round(
        startValue + (endValue - startValue) * easeProgress
      );

      setDisplayValue(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        previousValue.current = endValue;
      }
    }

    requestAnimationFrame(animate);
  }, [value, duration]);

  return (
    <span className="tabular-nums">
      {displayValue.toLocaleString()}
      {suffix}
    </span>
  );
}

function formatLargeNumber(num: string | number): { value: number; suffix: string } {
  const n = typeof num === "string" ? parseInt(num, 10) : num;
  if (isNaN(n)) return { value: 0, suffix: "" };
  if (n >= 1000000000) return { value: Math.round(n / 10000000) / 100, suffix: "B" };
  if (n >= 1000000) return { value: Math.round(n / 10000) / 100, suffix: "M" };
  if (n >= 1000) return { value: Math.round(n / 10) / 100, suffix: "K" };
  return { value: n, suffix: "" };
}

function StatCard({
  icon: Icon,
  label,
  value,
  suffix = "",
  subtext,
  isLive = false,
  isEmpty = false,
  emptyText = "Growing",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  suffix?: string;
  subtext?: string;
  isLive?: boolean;
  isEmpty?: boolean;
  emptyText?: string;
}) {
  return (
    <Card className="relative overflow-hidden bg-gray-900/80 border-gray-800 backdrop-blur-sm">
      {isLive && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-xs text-green-400 font-medium">LIVE</span>
        </div>
      )}
      <CardContent className="pt-6 pb-5">
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Icon className="h-5 w-5 text-blue-400" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-400 font-medium">{label}</p>
            <div className="mt-1">
              {isEmpty ? (
                <p className="text-3xl font-bold text-gray-300">{emptyText}</p>
              ) : (
                <p className="text-3xl font-bold text-gray-100">
                  <AnimatedNumber value={value} suffix={suffix} />
                </p>
              )}
            </div>
            {subtext && (
              <p className="mt-1 text-xs text-gray-500">{subtext}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatSkeleton() {
  return (
    <Card className="bg-gray-900/80 border-gray-800 backdrop-blur-sm">
      <CardContent className="pt-6 pb-5">
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-lg bg-gray-800 animate-pulse">
            <div className="h-5 w-5" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-4 w-24 bg-gray-800 rounded animate-pulse" />
            <div className="h-8 w-32 bg-gray-800 rounded animate-pulse" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const { data: stats, isLoading, error } = useSWR<NetworkStats>(
    "/api/v1/stats",
    fetcher,
    {
      refreshInterval: 30000, // Poll every 30 seconds
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  const feedersOnline = stats?.network.feeders.online ?? 0;
  const liveAircraft = stats?.live.aircraft_with_position ?? 0;
  const messageRate = stats?.live.message_rate ?? 0;
  const totalPositions = stats?.network.positions_total ?? "0";
  const positionsFormatted = formatLargeNumber(totalPositions);

  return (
    <main className="min-h-screen bg-gray-950">
      {/* Subtle gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent pointer-events-none" />

      {/* Content */}
      <div className="relative z-10">
        {/* Navigation */}
        <nav className="border-b border-gray-800/50 backdrop-blur-sm bg-gray-950/50 sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2.5 font-semibold text-lg text-gray-100"
            >
              <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Plane className="h-5 w-5 text-blue-400" aria-hidden="true" />
              </div>
              HangarTrak Radar
            </Link>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                asChild
                className="text-gray-300 hover:text-gray-100 hover:bg-gray-800"
              >
                <Link href="/leaderboard">Leaderboard</Link>
              </Button>
              <Button
                variant="ghost"
                asChild
                className="text-gray-300 hover:text-gray-100 hover:bg-gray-800"
              >
                <Link href="/login">Sign In</Link>
              </Button>
              <Button
                asChild
                className="bg-blue-600 hover:bg-blue-500 text-white"
              >
                <Link href="/register">Get Started</Link>
              </Button>
            </div>
          </div>
        </nav>

        <div className="container mx-auto px-4 py-16 md:py-24">
          {/* Hero Section */}
          <div className="text-center mb-16 md:mb-20">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6">
              <Activity className="h-4 w-4" aria-hidden="true" />
              Community-Powered Flight Tracking
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-100 mb-6 text-balance leading-tight">
              Own Your Airspace Data
            </h1>
            <p className="text-lg md:text-xl text-gray-400 mb-8 max-w-2xl mx-auto text-balance">
              Join our independent ADS-B network. No corporate middlemen. No rate limits.
              Just pilots and enthusiasts sharing flight data freely.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                asChild
                className="bg-blue-600 hover:bg-blue-500 text-white px-8"
              >
                <Link href="/register">
                  Start Feeding
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-gray-100 px-8"
              >
                <Link
                  href={process.env.NEXT_PUBLIC_MAP_URL || "/map"}
                  target="_blank"
                >
                  <Globe className="mr-2 h-4 w-4" aria-hidden="true" />
                  View Live Map
                </Link>
              </Button>
            </div>
          </div>

          {/* Live Stats Section */}
          <section aria-labelledby="stats-heading" className="mb-20">
            <h2 id="stats-heading" className="sr-only">
              Network Statistics
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {isLoading ? (
                <>
                  <StatSkeleton />
                  <StatSkeleton />
                  <StatSkeleton />
                  <StatSkeleton />
                </>
              ) : error ? (
                <div className="col-span-full">
                  <Card className="bg-gray-900/80 border-gray-800">
                    <CardContent className="py-8 text-center">
                      <p className="text-gray-400">
                        Unable to load network stats. Please try again later.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <>
                  <StatCard
                    icon={Radio}
                    label="Active Feeders"
                    value={feedersOnline}
                    isLive
                    isEmpty={feedersOnline === 0}
                    emptyText="Launching"
                    subtext={
                      stats?.network.feeders.total
                        ? `${stats.network.feeders.total} total registered`
                        : undefined
                    }
                  />
                  <StatCard
                    icon={Plane}
                    label="Aircraft Tracked"
                    value={liveAircraft}
                    isLive
                    isEmpty={liveAircraft === 0}
                    emptyText="Starting up"
                    subtext={
                      stats?.network.aircraft_tracked
                        ? `${stats.network.aircraft_tracked.toLocaleString()} unique aircraft seen`
                        : undefined
                    }
                  />
                  <StatCard
                    icon={Activity}
                    label="Messages/Second"
                    value={Math.round(messageRate)}
                    suffix="/s"
                    isEmpty={messageRate === 0}
                    emptyText="Warming up"
                    subtext="Real-time throughput"
                  />
                  <StatCard
                    icon={MapPin}
                    label="Positions Recorded"
                    value={positionsFormatted.value}
                    suffix={positionsFormatted.suffix}
                    isEmpty={parseInt(totalPositions) === 0}
                    emptyText="Collecting"
                    subtext="Total positions logged"
                  />
                </>
              )}
            </div>
          </section>

          {/* Value Proposition */}
          <section className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-100 mb-4">
                Why HangarTrak Radar?
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                Unlike commercial services that lock you into subscriptions and rate limits,
                we believe flight data should be open and community-owned.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="bg-gray-900/50 border-gray-800 hover:border-gray-700 transition-colors">
                <CardContent className="pt-6">
                  <div className="p-2.5 rounded-lg bg-green-500/10 border border-green-500/20 w-fit mb-4">
                    <Zap className="h-5 w-5 text-green-400" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-100 mb-2">
                    Unlimited API Access
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Active feeders get 1,000 requests per minute. Build apps without hitting paywalls.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gray-900/50 border-gray-800 hover:border-gray-700 transition-colors">
                <CardContent className="pt-6">
                  <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 w-fit mb-4">
                    <Users className="h-5 w-5 text-purple-400" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-100 mb-2">
                    Community Owned
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Your data, our network. No corporate middlemen selling your contributions.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gray-900/50 border-gray-800 hover:border-gray-700 transition-colors">
                <CardContent className="pt-6">
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 w-fit mb-4">
                    <Trophy className="h-5 w-5 text-amber-400" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-100 mb-2">
                    Earn Your Rank
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Compete on the leaderboard. Get scored on uptime, coverage, and data quality.
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Features Section */}
          <section className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-100 mb-4">
                Everything You Need
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-6 rounded-xl border border-gray-800 bg-gray-900/30">
                <Radio
                  className="h-8 w-8 text-blue-400 mb-4"
                  aria-hidden="true"
                />
                <h3 className="text-lg font-semibold text-gray-100 mb-2">
                  Easy Setup
                </h3>
                <p className="text-gray-400 text-sm">
                  One command to start feeding from your Raspberry Pi running readsb or dump1090.
                </p>
              </div>

              <div className="p-6 rounded-xl border border-gray-800 bg-gray-900/30">
                <Key
                  className="h-8 w-8 text-blue-400 mb-4"
                  aria-hidden="true"
                />
                <h3 className="text-lg font-semibold text-gray-100 mb-2">
                  Free API Access
                </h3>
                <p className="text-gray-400 text-sm">
                  Active feeders get elevated API access. Build your own flight tracking apps.
                </p>
              </div>

              <div className="p-6 rounded-xl border border-gray-800 bg-gray-900/30">
                <BarChart3
                  className="h-8 w-8 text-blue-400 mb-4"
                  aria-hidden="true"
                />
                <h3 className="text-lg font-semibold text-gray-100 mb-2">
                  Detailed Stats
                </h3>
                <p className="text-gray-400 text-sm">
                  Track your feeder performance with message rates, range stats, and uptime charts.
                </p>
              </div>

              <div className="p-6 rounded-xl border border-gray-800 bg-gray-900/30">
                <Plane
                  className="h-8 w-8 text-blue-400 mb-4"
                  aria-hidden="true"
                />
                <h3 className="text-lg font-semibold text-gray-100 mb-2">
                  Live Map
                </h3>
                <p className="text-gray-400 text-sm">
                  Watch aircraft in real-time with trails, altitude colors, and emergency alerts.
                </p>
              </div>
            </div>
          </section>

          {/* How It Works */}
          <section className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-100 mb-4">
                Get Started in Minutes
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  1
                </div>
                <h3 className="font-semibold text-gray-100 mb-2">
                  Create Account
                </h3>
                <p className="text-gray-400 text-sm">
                  Sign up and register your feeder to get a unique ID and install script.
                </p>
              </div>
              <div className="text-center">
                <div className="w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  2
                </div>
                <h3 className="font-semibold text-gray-100 mb-2">
                  Run Install Script
                </h3>
                <p className="text-gray-400 text-sm">
                  One command configures your Pi to send ADS-B data to our network.
                </p>
              </div>
              <div className="text-center">
                <div className="w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  3
                </div>
                <h3 className="font-semibold text-gray-100 mb-2">
                  Get API Access
                </h3>
                <p className="text-gray-400 text-sm">
                  Once your feeder is online, you automatically get elevated API access.
                </p>
              </div>
            </div>

            <div className="text-center mt-10">
              <Button
                size="lg"
                asChild
                className="bg-blue-600 hover:bg-blue-500 text-white px-8"
              >
                <Link href="/register">
                  Create Free Account
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </section>

          {/* CTA Section */}
          <section>
            <Card className="bg-gradient-to-br from-blue-900/30 to-gray-900/50 border-blue-800/30">
              <CardContent className="py-12 text-center">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-100 mb-4">
                  Ready to Join the Network?
                </h2>
                <p className="text-gray-400 mb-8 max-w-xl mx-auto">
                  Whether you have a Raspberry Pi with an ADS-B receiver or just want to
                  explore the API, getting started is free.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    size="lg"
                    asChild
                    className="bg-blue-600 hover:bg-blue-500 text-white px-8"
                  >
                    <Link href="/register">Start Feeding</Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    asChild
                    className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-gray-100 px-8"
                  >
                    <Link href="/leaderboard">View Leaderboard</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>

        {/* Footer */}
        <footer className="border-t border-gray-800/50 mt-20">
          <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-gray-400">
                <Plane className="h-4 w-4" aria-hidden="true" />
                <span>HangarTrak Radar</span>
              </div>
              <p className="text-gray-500 text-sm">
                Community-powered flight tracking for everyone
              </p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <Link href="/docs" className="hover:text-gray-300 transition-colors">
                  Docs
                </Link>
                <Link href="/leaderboard" className="hover:text-gray-300 transition-colors">
                  Leaderboard
                </Link>
                <Link
                  href={process.env.NEXT_PUBLIC_MAP_URL || "/map"}
                  target="_blank"
                  className="hover:text-gray-300 transition-colors"
                >
                  Live Map
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
