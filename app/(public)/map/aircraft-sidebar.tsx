"use client";

import { useMemo, useState } from "react";
import {
  Aircraft,
  formatAltitude,
  formatSpeed,
  getAltitudeColor,
  getDistanceNm,
  getEmergencyInfo,
} from "./types";
import { FlightSearch } from "./flight-search";
import { Radio, Search } from "lucide-react";

type SortField = "callsign" | "altitude" | "speed" | "squawk" | "distance";
type SidebarTab = "live" | "search";

interface AircraftSidebarProps {
  aircraft: Aircraft[];
  selectedHex: string | null;
  onSelectAircraft: (hex: string) => void;
  mapCenter: { lat: number; lng: number };
  isOpen: boolean;
  onToggle: () => void;
  onSelectFlight?: (flightId: string) => void;
}

export function AircraftSidebar({
  aircraft,
  selectedHex,
  onSelectAircraft,
  mapCenter,
  isOpen,
  onToggle,
  onSelectFlight,
}: AircraftSidebarProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("distance");
  const [activeTab, setActiveTab] = useState<SidebarTab>("live");

  const filteredAndSorted = useMemo(() => {
    const query = search.toLowerCase().trim();

    let filtered = aircraft;
    if (query) {
      filtered = aircraft.filter((ac) => {
        const callsign = (ac.flight || "").toLowerCase();
        const hex = ac.hex.toLowerCase();
        const reg = (ac.registration || "").toLowerCase();
        const type = (ac.type || "").toLowerCase();
        return (
          callsign.includes(query) ||
          hex.includes(query) ||
          reg.includes(query) ||
          type.includes(query)
        );
      });
    }

    const withDistance = filtered.map((ac) => ({
      ...ac,
      distance: getDistanceNm(mapCenter.lat, mapCenter.lng, ac.lat, ac.lon),
    }));

    withDistance.sort((a, b) => {
      // Always put emergencies first when sorting by squawk
      if (sortField === "squawk") {
        const aEmerg = getEmergencyInfo(a.squawk) ? 0 : 1;
        const bEmerg = getEmergencyInfo(b.squawk) ? 0 : 1;
        if (aEmerg !== bEmerg) return aEmerg - bEmerg;
        return (a.squawk || "9999").localeCompare(b.squawk || "9999");
      }

      switch (sortField) {
        case "callsign":
          return (a.flight || a.hex).localeCompare(b.flight || b.hex);
        case "altitude":
          return (b.altitude ?? -1) - (a.altitude ?? -1);
        case "speed":
          return (b.ground_speed ?? -1) - (a.ground_speed ?? -1);
        case "distance":
          return a.distance - b.distance;
        default:
          return 0;
      }
    });

    return withDistance;
  }, [aircraft, search, sortField, mapCenter]);

  return (
    <>
      {/* Sidebar panel */}
      <div
        className={`absolute top-0 left-0 bottom-0 w-80 hidden md:flex flex-col bg-gray-900/95 backdrop-blur-sm border-r border-gray-700 z-10 transition-transform duration-200 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header with tabs */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("live")}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                activeTab === "live"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
              }`}
              aria-pressed={activeTab === "live"}
            >
              <Radio className="w-3 h-3" />
              Live
              <span className="text-[10px] opacity-80">({aircraft.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("search")}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                activeTab === "search"
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 bg-gray-800 hover:text-white hover:bg-gray-700"
              }`}
              aria-pressed={activeTab === "search"}
            >
              <Search className="w-3 h-3" />
              Search
            </button>
          </div>
          <button
            onClick={onToggle}
            className="text-gray-400 hover:text-white p-1"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M10 12L6 8L10 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Live tab: Search */}
        {activeTab === "live" && (
          <div className="px-3 py-2 border-b border-gray-700">
            <input
              type="text"
              placeholder="Search callsign, reg, hex\u2026"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus:border-gray-400"
              aria-label="Search aircraft"
            />
          </div>
        )}

        {/* Live tab: Sort */}
        {activeTab === "live" && (
          <div className="px-3 py-1.5 border-b border-gray-700 flex items-center gap-2">
            <span className="text-xs text-gray-500">Sort:</span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="bg-gray-800 border border-gray-600 rounded px-1.5 py-0.5 text-xs text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus:border-gray-400"
              aria-label="Sort aircraft"
            >
              <option value="distance">Distance</option>
              <option value="callsign">Callsign</option>
              <option value="altitude">Altitude</option>
              <option value="speed">Speed</option>
              <option value="squawk">Squawk</option>
            </select>
          </div>
        )}

        {/* Live tab: Aircraft list */}
        {activeTab === "live" && (
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {filteredAndSorted.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                {search ? "No aircraft match your search" : "No aircraft"}
              </div>
            ) : (
              filteredAndSorted.map((ac) => {
                const emergency = getEmergencyInfo(ac.squawk);
                const isSelected = ac.hex === selectedHex;

                return (
                  <button
                    key={ac.hex}
                    onClick={() => onSelectAircraft(ac.hex)}
                    className={`w-full text-left px-3 py-2 border-b border-gray-800 transition-colors ${
                      isSelected
                        ? "bg-blue-900/40 border-l-2 border-l-blue-500"
                        : "hover:bg-gray-800/60"
                    }`}
                    style={{ contentVisibility: 'auto', containIntrinsicSize: '0 52px' }}
                  >
                    <div className="flex items-center gap-2">
                      {/* Altitude color dot */}
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: getAltitudeColor(ac.altitude) }}
                      />
                      {/* Callsign */}
                      <span className="text-sm font-medium text-gray-100 truncate">
                        {ac.flight?.trim() || ac.hex.toUpperCase()}
                      </span>
                      {/* Emergency badge */}
                      {emergency && (
                        <span
                          className="text-[10px] font-bold px-1 py-0.5 rounded shrink-0 animate-pulse"
                          style={{
                            backgroundColor: emergency.color,
                            color: "white",
                          }}
                        >
                          {emergency.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                      <span>{formatAltitude(ac.altitude)}</span>
                      <span>{formatSpeed(ac.ground_speed)}</span>
                      <span className="ml-auto text-gray-500">
                        {Math.round(ac.distance)} nm
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Search tab: Flight search */}
        {activeTab === "search" && onSelectFlight && (
          <FlightSearch onSelectFlight={onSelectFlight} />
        )}
      </div>

      {/* Toggle button when collapsed */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="absolute top-1/2 left-0 -translate-y-1/2 hidden md:flex items-center justify-center w-6 h-12 bg-gray-900/90 backdrop-blur-sm border border-l-0 border-gray-700 rounded-r-md text-gray-400 hover:text-white z-10"
          title="Show aircraft list"
          aria-label="Expand sidebar"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M6 4L10 8L6 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </>
  );
}
