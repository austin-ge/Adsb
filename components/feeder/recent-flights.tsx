"use client";

import { Plane } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flight, formatDuration, formatFlightDate } from "./types";

interface RecentFlightsProps {
  flights: Flight[] | undefined;
}

export function RecentFlights({ flights }: RecentFlightsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plane className="h-5 w-5" aria-hidden="true" />
          Recent Flights
        </CardTitle>
      </CardHeader>
      <CardContent>
        {flights && flights.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Recent flights tracked by this feeder</caption>
              <thead>
                <tr className="border-b border-gray-700">
                  <th scope="col" className="text-left py-2 px-2 font-medium text-muted-foreground">
                    Callsign
                  </th>
                  <th scope="col" className="text-left py-2 px-2 font-medium text-muted-foreground">
                    Hex
                  </th>
                  <th scope="col" className="text-left py-2 px-2 font-medium text-muted-foreground">
                    Date
                  </th>
                  <th scope="col" className="text-right py-2 px-2 font-medium text-muted-foreground">
                    Duration
                  </th>
                  <th scope="col" className="text-right py-2 px-2 font-medium text-muted-foreground">
                    Max Alt
                  </th>
                </tr>
              </thead>
              <tbody>
                {flights.map((flight) => (
                  <tr
                    key={flight.id}
                    className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="py-2 px-2 font-mono">
                      {flight.callsign || "--"}
                    </td>
                    <td className="py-2 px-2 font-mono text-muted-foreground">
                      {flight.hex.toUpperCase()}
                    </td>
                    <td className="py-2 px-2 text-muted-foreground">
                      {formatFlightDate(flight.endTime)}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {formatDuration(flight.durationSecs)}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {flight.maxAltitude !== null
                        ? `${flight.maxAltitude.toLocaleString()} ft`
                        : "--"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            No flight data yet
          </p>
        )}
      </CardContent>
    </Card>
  );
}
