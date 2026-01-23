"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { formatNumber } from "@/lib/format";
import { Plus, Radio, Copy, Check, ExternalLink } from "lucide-react";
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

interface Feeder {
  id: string;
  uuid: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  messagesTotal: string;
  positionsTotal: string;
  aircraftSeen: number;
  lastSeen: string | null;
  isOnline: boolean;
  createdAt: string;
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
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function FeedersPage() {
  const { data: feeders, error, mutate } = useSWR<Feeder[]>("/api/feeders", fetcher);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newFeederName, setNewFeederName] = useState("");
  const [newFeederLat, setNewFeederLat] = useState("");
  const [newFeederLng, setNewFeederLng] = useState("");
  const [createdFeeder, setCreatedFeeder] = useState<Feeder | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreateFeeder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const response = await fetch("/api/feeders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newFeederName,
          latitude: newFeederLat || null,
          longitude: newFeederLng || null,
        }),
      });

      if (response.ok) {
        const feeder = await response.json();
        setCreatedFeeder(feeder);
        mutate();
      }
    } catch (error) {
      console.error("Failed to create feeder:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyCommand = async () => {
    if (!createdFeeder) return;
    const command = `curl -sSL ${window.location.origin}/api/install/${createdFeeder.uuid} | sudo bash`;
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setNewFeederName("");
    setNewFeederLat("");
    setNewFeederLng("");
    setCreatedFeeder(null);
    setCopied(false);
  };

  if (error) {
    return (
      <div className="p-8">
        <p className="text-red-500">Failed to load feeders</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Feeders</h1>
          <p className="text-muted-foreground">
            Manage your ADS-B feeders and view their statistics
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Register Feeder
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            {!createdFeeder ? (
              <>
                <DialogHeader>
                  <DialogTitle>Register New Feeder</DialogTitle>
                  <DialogDescription>
                    Register your Raspberry Pi to start feeding ADS-B data to our
                    network.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateFeeder}>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Feeder Name</Label>
                      <Input
                        id="name"
                        placeholder="My Home Feeder"
                        value={newFeederName}
                        onChange={(e) => setNewFeederName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="latitude">Latitude (optional)</Label>
                        <Input
                          id="latitude"
                          type="number"
                          step="any"
                          placeholder="51.5074"
                          value={newFeederLat}
                          onChange={(e) => setNewFeederLat(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="longitude">Longitude (optional)</Label>
                        <Input
                          id="longitude"
                          type="number"
                          step="any"
                          placeholder="-0.1278"
                          value={newFeederLng}
                          onChange={(e) => setNewFeederLng(e.target.value)}
                        />
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Location helps show your feeder on the coverage map and
                      calculate range statistics.
                    </p>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isCreating || !newFeederName}>
                      {isCreating ? "Creating\u2026" : "Create Feeder"}
                    </Button>
                  </DialogFooter>
                </form>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Feeder Created!</DialogTitle>
                  <DialogDescription>
                    Run this command on your Raspberry Pi to start feeding:
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <div className="relative">
                    <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                      curl -sSL {window.location.origin}/api/install/
                      {createdFeeder.uuid} | sudo bash
                    </pre>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2"
                      onClick={handleCopyCommand}
                      aria-label="Copy install command"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="mt-4 space-y-2 text-sm">
                    <p>
                      <strong>Feeder UUID:</strong>{" "}
                      <code className="bg-muted px-1 rounded">
                        {createdFeeder.uuid}
                      </code>
                    </p>
                    <p className="text-muted-foreground">
                      The install script will automatically configure your readsb
                      or ultrafeeder installation.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={handleCloseDialog}>
                    Close
                  </Button>
                  <Button asChild>
                    <Link href={`/feeders/${createdFeeder.id}`}>
                      View Feeder
                      <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {!feeders ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-5 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : feeders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Radio className="h-12 w-12 text-muted-foreground mb-4" aria-hidden="true" />
            <h3 className="text-lg font-semibold mb-2">No feeders yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Register your first feeder to start contributing to our network.
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Register Feeder
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {feeders.map((feeder) => (
            <Link key={feeder.id} href={`/feeders/${feeder.id}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{feeder.name}</CardTitle>
                    <Badge variant={feeder.isOnline ? "success" : "secondary"}>
                      {feeder.isOnline ? "Online" : "Offline"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Messages</p>
                      <p className="font-semibold">
                        {formatNumber(feeder.messagesTotal)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Positions</p>
                      <p className="font-semibold">
                        {formatNumber(feeder.positionsTotal)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Aircraft</p>
                      <p className="font-semibold">{feeder.aircraftSeen}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Last seen: {formatLastSeen(feeder.lastSeen)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
