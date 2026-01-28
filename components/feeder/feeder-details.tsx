"use client";

import { Radio, MapPin, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Feeder, formatSoftwareType } from "./types";

interface FeederDetailsProps {
  feeder: Feeder;
  copiedItem: "uuid" | "command" | "share" | null;
  onCopyUuid: () => void;
}

export function FeederDetails({
  feeder,
  copiedItem,
  onCopyUuid,
}: FeederDetailsProps) {
  return (
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
            <Button size="sm" variant="ghost" onClick={onCopyUuid} aria-label="Copy UUID">
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
        {(feeder.latitude !== null || feeder.longitude !== null) && (
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
  );
}
