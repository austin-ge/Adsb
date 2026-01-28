"use client";

import { Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NearbyAirport } from "./types";

interface NearbyAirportsProps {
  airports: NearbyAirport[];
}

export function NearbyAirports({ airports }: NearbyAirportsProps) {
  if (airports.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" aria-hidden="true" />
          Nearby Airports
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2">
          {airports.map((airport) => (
            <div
              key={airport.icao}
              className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <code className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded shrink-0">
                  {airport.icao}
                </code>
                <span className="text-sm text-muted-foreground truncate">
                  {airport.name}
                </span>
              </div>
              <span className="font-mono text-sm tabular-nums shrink-0 ml-2">
                {airport.distance.toFixed(1)} nm
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
