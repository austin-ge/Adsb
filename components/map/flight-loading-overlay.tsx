"use client";

interface FlightLoadingOverlayProps {
  isLoading: boolean;
}

export function FlightLoadingOverlay({ isLoading }: FlightLoadingOverlayProps) {
  if (!isLoading) {
    return null;
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-30">
      <div className="bg-gray-800 rounded-lg px-6 py-4 shadow-xl border border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-white text-sm font-medium">Loading flight data...</span>
        </div>
      </div>
    </div>
  );
}
