"use client";

interface StatsOverlayProps {
  aircraftCount: number;
  emergencyCount: number;
  isPlaybackMode: boolean;
  updateStatus: string;
  sidebarOpen: boolean;
}

export function StatsOverlay({
  aircraftCount,
  emergencyCount,
  isPlaybackMode,
  updateStatus,
  sidebarOpen,
}: StatsOverlayProps) {
  return (
    <>
      {/* Stats overlay - desktop (shifts based on sidebar) */}
      <div
        className={`absolute top-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200 font-mono tabular-nums transition-[left] duration-200 border border-gray-200 dark:border-transparent shadow-lg dark:shadow-none ${sidebarOpen ? "left-[21rem]" : "left-4"} hidden md:block`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="flex items-center gap-3">
          <span>{aircraftCount} aircraft</span>
          {emergencyCount > 0 && (
            <>
              <span className="text-gray-400 dark:text-gray-500">|</span>
              <span className="text-red-600 dark:text-red-400 font-bold animate-pulse">
                {emergencyCount} emergency
              </span>
            </>
          )}
          <span className="text-gray-400 dark:text-gray-500">|</span>
          {isPlaybackMode ? (
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              PLAYBACK
            </span>
          ) : (
            <span className="text-gray-500 dark:text-gray-400">
              {updateStatus}
            </span>
          )}
        </div>
      </div>

      {/* Stats overlay - mobile (always left-4) */}
      <div className="absolute top-4 left-4 bg-gray-900/90 backdrop-blur-sm rounded-lg px-3 py-2 text-sm text-gray-200 font-mono tabular-nums md:hidden">
        <div className="flex items-center gap-3">
          <span>{aircraftCount} aircraft</span>
          {isPlaybackMode ? (
            <>
              <span className="text-gray-500">|</span>
              <span className="text-amber-400 font-medium">PLAYBACK</span>
            </>
          ) : emergencyCount > 0 ? (
            <>
              <span className="text-gray-500">|</span>
              <span className="text-red-400 font-bold animate-pulse">
                {emergencyCount} emergency
              </span>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
