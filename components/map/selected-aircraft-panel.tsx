"use client";

import { Aircraft, getEmergencyInfo } from "@/app/(public)/map/types";
import { useUnits } from "@/lib/units";

interface SelectedAircraftPanelProps {
  aircraft: Aircraft;
  onClose: () => void;
}

export function SelectedAircraftPanel({
  aircraft,
  onClose,
}: SelectedAircraftPanelProps) {
  const { formatAltitude, formatSpeed, formatVerticalRate } = useUnits();
  const emergency = getEmergencyInfo(aircraft.squawk);

  return (
    <div className="absolute top-4 right-4 w-72 bg-gray-900/95 backdrop-blur-sm rounded-lg border border-gray-700 shadow-xl overflow-hidden">
      {emergency && (
        <div
          className="px-4 py-2 text-center text-white font-bold text-sm animate-pulse"
          style={{ backgroundColor: emergency.color }}
        >
          {emergency.label} (SQUAWK {aircraft.squawk})
          <div className="text-xs font-normal opacity-90">
            {emergency.description}
          </div>
        </div>
      )}
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div>
          <div className="text-white font-bold text-lg">
            {aircraft.flight || aircraft.hex.toUpperCase()}
          </div>
          {aircraft.registration && (
            <div className="text-gray-400 text-sm">
              {aircraft.registration}
              {aircraft.type && ` \u00b7 ${aircraft.type}`}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-xl leading-none min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded"
          aria-label="Close aircraft details"
        >
          &times;
        </button>
      </div>
      <div className="px-4 py-3 space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-gray-500 text-xs uppercase">Altitude</div>
            <div className="text-white font-medium">
              {formatAltitude(aircraft.altitude)}
            </div>
          </div>
          <div>
            <div className="text-gray-500 text-xs uppercase">Speed</div>
            <div className="text-white font-medium">
              {formatSpeed(aircraft.ground_speed)}
            </div>
          </div>
          <div>
            <div className="text-gray-500 text-xs uppercase">
              Vertical Rate
            </div>
            <div className="text-white font-medium">
              {formatVerticalRate(aircraft.vertical_rate)}
            </div>
          </div>
          <div>
            <div className="text-gray-500 text-xs uppercase">Heading</div>
            <div className="text-white font-medium">
              {aircraft.track !== null
                ? `${Math.round(aircraft.track)}\u00b0`
                : "\u2014"}
            </div>
          </div>
          <div>
            <div className="text-gray-500 text-xs uppercase">Squawk</div>
            <div className={`font-medium ${
              emergency
                ? "text-red-400 font-bold"
                : "text-white"
            }`}>
              {aircraft.squawk || "\u2014"}
            </div>
          </div>
          <div>
            <div className="text-gray-500 text-xs uppercase">ICAO</div>
            <div className="text-white font-medium font-mono">
              {aircraft.hex.toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
