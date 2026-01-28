"use client";

import { useUnits, getAltitudeRanges } from "@/lib/units";

interface AltitudeLegendProps {
  sidebarOpen: boolean;
}

export function AltitudeLegend({ sidebarOpen }: AltitudeLegendProps) {
  const { units } = useUnits();

  return (
    <div
      className={`absolute bottom-8 bg-gray-900/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-gray-300 transition-[left] duration-200 ${sidebarOpen ? "md:left-[21rem]" : "left-4"} left-4`}
    >
      <div className="font-semibold mb-1 text-gray-100">Altitude</div>
      <div className="flex flex-col gap-0.5">
        {getAltitudeRanges(units).map(({ color, label }) => (
          <div key={color} className="flex items-center gap-2">
            <div
              className="w-3 h-2 rounded-sm"
              style={{ backgroundColor: color }}
            />
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-700 mt-2 pt-2">
        <div className="font-semibold mb-1 text-gray-100">Emergency</div>
        <div className="flex flex-col gap-0.5">
          {[
            { color: "#ff0000", code: "7500", label: "Hijack" },
            { color: "#ff8c00", code: "7600", label: "Radio failure" },
            { color: "#ff0000", code: "7700", label: "Emergency" },
          ].map(({ color, code, label }) => (
            <div key={code} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full animate-pulse"
                style={{ backgroundColor: color }}
              />
              <span>{code} \u2013 {label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
