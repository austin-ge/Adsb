"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  Key,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  AlertTriangle,
  ExternalLink,
  Shield,
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
} from "@/components/ui/dialog";

interface ApiKeyInfo {
  hasApiKey: boolean;
  maskedKey: string | null;
  tier: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const tierInfo = {
  FREE: {
    label: "Free",
    limit: "100 requests/min",
    color: "secondary" as const,
    description: "Basic access for testing and light usage",
  },
  FEEDER: {
    label: "Feeder",
    limit: "1,000 requests/min",
    color: "success" as const,
    description: "Full access for active feeders - automatically granted",
  },
  PRO: {
    label: "Pro",
    limit: "10,000 requests/min",
    color: "default" as const,
    description: "Maximum access for commercial applications",
  },
};

export default function ApiKeysPage() {
  const { data, error, mutate } = useSWR<ApiKeyInfo>(
    "/api/user/api-key",
    fetcher
  );

  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);

  const handleGenerateKey = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/user/api-key", {
        method: "POST",
      });
      const result = await response.json();
      if (response.ok) {
        setNewApiKey(result.apiKey);
        mutate();
      }
    } catch (error) {
      console.error("Failed to generate API key:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevokeKey = async () => {
    setIsRevoking(true);
    try {
      const response = await fetch("/api/user/api-key", {
        method: "DELETE",
      });
      if (response.ok) {
        mutate();
        setShowRevokeDialog(false);
      }
    } catch (error) {
      console.error("Failed to revoke API key:", error);
    } finally {
      setIsRevoking(false);
    }
  };

  const handleCopyKey = async () => {
    if (!newApiKey) return;
    await navigator.clipboard.writeText(newApiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCloseNewKeyDialog = () => {
    setNewApiKey(null);
    setCopied(false);
  };

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">API Keys</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-red-500">Failed to load API key information</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tier = data?.tier as keyof typeof tierInfo || "FREE";
  const currentTier = tierInfo[tier] || tierInfo.FREE;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">API Keys</h1>
        <p className="text-muted-foreground">
          Manage your API access for programmatic data retrieval
        </p>
      </div>

      {/* Current Tier */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Your API Tier
            </CardTitle>
            <Badge variant={currentTier.color}>{currentTier.label}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="font-medium">Rate Limit: {currentTier.limit}</p>
              <p className="text-sm text-muted-foreground">
                {currentTier.description}
              </p>
            </div>
            {tier === "FREE" && (
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm">
                  <strong>Want higher limits?</strong> Register a feeder and
                  start contributing to our network. Active feeders
                  automatically get upgraded to the FEEDER tier with 10x the
                  rate limit!
                </p>
                <Link href="/feeders">
                  <Button variant="outline" size="sm" className="mt-2">
                    Register a Feeder
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* API Key Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Key
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data ? (
            <div className="animate-pulse space-y-4">
              <div className="h-12 bg-muted rounded" />
              <div className="h-10 bg-muted rounded w-32" />
            </div>
          ) : data.hasApiKey ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">
                  Your API Key (masked)
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="bg-muted px-3 py-2 rounded text-sm flex-1 font-mono">
                    {data.maskedKey}
                  </code>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleGenerateKey}
                  disabled={isGenerating}
                >
                  <RefreshCw
                    className={`mr-2 h-4 w-4 ${isGenerating ? "animate-spin" : ""}`}
                  />
                  Regenerate Key
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowRevokeDialog(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Revoke Key
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Regenerating will invalidate your current key. Make sure to
                update any applications using the old key.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                You haven&apos;t generated an API key yet. Generate one to start
                using our API.
              </p>
              <Button onClick={handleGenerateKey} disabled={isGenerating}>
                <Key className="mr-2 h-4 w-4" />
                {isGenerating ? "Generating..." : "Generate API Key"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Start */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Start</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Use your API key by including it in the <code>x-api-key</code>{" "}
            header:
          </p>
          <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`curl -H "x-api-key: YOUR_API_KEY" \\
  ${typeof window !== "undefined" ? window.location.origin : ""}/api/v1/aircraft`}
          </pre>
          <div className="flex gap-2">
            <Link href="/docs/api">
              <Button variant="outline">
                <ExternalLink className="mr-2 h-4 w-4" />
                View API Documentation
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* New API Key Dialog */}
      <Dialog open={!!newApiKey} onOpenChange={handleCloseNewKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              API Key Generated
            </DialogTitle>
            <DialogDescription>
              Copy your API key now. For security reasons, it won&apos;t be shown
              again.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="relative">
              <code className="block bg-muted p-4 rounded-lg text-sm font-mono break-all">
                {newApiKey}
              </code>
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-2 right-2"
                onClick={handleCopyKey}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="mt-4 flex items-start gap-2 text-sm text-yellow-600 dark:text-yellow-500">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>
                Store this key securely. You won&apos;t be able to see it again.
                If you lose it, you&apos;ll need to generate a new one.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCloseNewKeyDialog}>
              {copied ? "Done" : "I've copied my key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <Dialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke API Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke your API key? Any applications
              using this key will immediately lose access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRevokeDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevokeKey}
              disabled={isRevoking}
            >
              {isRevoking ? "Revoking..." : "Revoke Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
