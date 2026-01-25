"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Search, ChevronDown, ChevronRight, Play, Plane } from "lucide-react";

export interface FlightSearchResult {
  hex: string;
  callsigns: string[];
  flightCount: number;
  lastSeen: string;
}

export interface FlightRecord {
  id: string;
  hex: string;
  callsign: string | null;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  maxAltitude: number | null;
  positionCount: number;
}

interface FlightSearchResponse {
  results: FlightSearchResult[];
  flights: Record<string, FlightRecord[]>;
}

interface FlightSearchProps {
  onSelectFlight: (flightId: string) => void;
}

export function FlightSearch({ onSelectFlight }: FlightSearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [expandedHex, setExpandedHex] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input by 300ms
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  // Fetch search results (only when query is at least 2 chars)
  // Uses internal /api/map/flights endpoint (no API key required)
  const { data, error, isLoading } = useSWR<FlightSearchResponse>(
    debouncedQuery.length >= 2
      ? `/api/map/flights?q=${encodeURIComponent(debouncedQuery)}`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const handleToggleExpand = useCallback((hex: string) => {
    setExpandedHex((prev) => (prev === hex ? null : hex));
  }, []);

  const formatDuration = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatAltitude = (alt: number | null) => {
    if (alt === null) return "--";
    if (alt >= 18000) return `FL${Math.round(alt / 100)}`;
    return `${alt.toLocaleString()} ft`;
  };

  const results = data?.results ?? [];
  const flights = data?.flights ?? {};

  return (
    <div className="flex flex-col h-full">
      {/* Search input */}
      <div className="px-3 py-2 border-b border-gray-700">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search callsign, hex, reg..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 pl-8 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus:border-gray-400"
            aria-label="Search flights"
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* Loading state */}
        {isLoading && debouncedQuery.length >= 2 && (
          <div className="px-3 py-4 text-sm text-gray-500 text-center">
            <span className="animate-pulse">Searching...</span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="px-3 py-4 text-sm text-red-400 text-center">
            Search failed. Try again.
          </div>
        )}

        {/* Empty prompt */}
        {!isLoading && !error && debouncedQuery.length < 2 && (
          <div className="px-3 py-8 text-center">
            <Plane className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              Enter at least 2 characters to search for flights
            </p>
          </div>
        )}

        {/* No results */}
        {!isLoading && !error && debouncedQuery.length >= 2 && results.length === 0 && (
          <div className="px-3 py-4 text-sm text-gray-500 text-center">
            No flights found for &quot;{debouncedQuery}&quot;
          </div>
        )}

        {/* Results list */}
        {!isLoading && results.length > 0 && (
          <div>
            {results.map((result) => {
              const isExpanded = expandedHex === result.hex;
              const aircraftFlights = flights[result.hex] ?? [];

              return (
                <div key={result.hex} className="border-b border-gray-800">
                  {/* Aircraft header */}
                  <button
                    onClick={() => handleToggleExpand(result.hex)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-800/60 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-100 font-mono">
                            {result.hex.toUpperCase()}
                          </span>
                          {result.callsigns.length > 0 && (
                            <span className="text-xs text-gray-400 truncate">
                              {result.callsigns.slice(0, 3).join(", ")}
                              {result.callsigns.length > 3 && "..."}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {result.flightCount} flight{result.flightCount !== 1 ? "s" : ""}
                          <span className="mx-1.5">|</span>
                          Last: {formatDate(result.lastSeen)} {formatTime(result.lastSeen)}
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Expanded flight list */}
                  {isExpanded && aircraftFlights.length > 0 && (
                    <div className="bg-gray-800/40 border-t border-gray-700/50">
                      {/* Table header */}
                      <div className="grid grid-cols-[70px_1fr_60px_70px_40px] gap-1 px-3 py-1.5 text-[10px] font-medium text-gray-500 uppercase tracking-wider border-b border-gray-700/50">
                        <span>Date</span>
                        <span>Callsign</span>
                        <span>Duration</span>
                        <span>Max Alt</span>
                        <span></span>
                      </div>

                      {/* Flight rows */}
                      {aircraftFlights.map((flight) => (
                        <div
                          key={flight.id}
                          className="grid grid-cols-[70px_1fr_60px_70px_40px] gap-1 px-3 py-1.5 items-center hover:bg-gray-700/30 transition-colors"
                        >
                          <span className="text-xs text-gray-400">
                            {formatDate(flight.startTime)}
                          </span>
                          <span className="text-xs text-gray-200 font-medium truncate">
                            {flight.callsign || "--"}
                          </span>
                          <span className="text-xs text-gray-400 tabular-nums">
                            {formatDuration(flight.durationMinutes)}
                          </span>
                          <span className="text-xs text-gray-400 tabular-nums">
                            {formatAltitude(flight.maxAltitude)}
                          </span>
                          <button
                            onClick={() => onSelectFlight(flight.id)}
                            className="w-6 h-6 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                            title="Replay flight"
                            aria-label={`Replay flight ${flight.callsign || flight.hex}`}
                          >
                            <Play className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Expanded but no flights loaded yet */}
                  {isExpanded && aircraftFlights.length === 0 && (
                    <div className="bg-gray-800/40 border-t border-gray-700/50 px-3 py-3 text-xs text-gray-500 text-center">
                      No flight records available
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
