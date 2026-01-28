"use client";

import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SetupInstructionsProps {
  feederUuid: string;
  copiedItem: "uuid" | "command" | "share" | null;
  onCopyCommand: () => void;
}

export function SetupInstructions({
  feederUuid,
  copiedItem,
  onCopyCommand,
}: SetupInstructionsProps) {
  return (
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
            curl -sSL {typeof window !== "undefined" ? window.location.origin : ""}/api/install/{feederUuid} | sudo bash
          </pre>
          <Button
            size="sm"
            variant="ghost"
            className="absolute top-1 right-1"
            onClick={onCopyCommand}
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
  );
}
