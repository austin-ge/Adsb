"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface PlaybackState {
  isPlayback: boolean;
  isPlaying: boolean;
  speed: number;
  currentTime: number; // ms timestamp
  startTime: number;
  endTime: number;
}

interface PlaybackSnapshot {
  timestamp: number;
  aircraft: Array<{
    hex: string;
    lat: number;
    lon: number;
    altitude: number | null;
    heading: number | null;
    speed: number | null;
    squawk: string | null;
    flight: string | null;
  }>;
}

interface PlaybackData {
  snapshots: PlaybackSnapshot[];
  snapshotCount: number;
}

interface PlaybackControlsProps {
  onPlaybackUpdate: (aircraft: PlaybackSnapshot["aircraft"], timestamp: number) => void;
  onPlaybackEnd: () => void;
  isPlayback: boolean;
  onEnterPlayback: () => void;
}

const SPEED_OPTIONS = [1, 2, 5, 10];
const DEFAULT_DURATION_MINUTES = 30;

export function PlaybackControls({
  onPlaybackUpdate,
  onPlaybackEnd,
  isPlayback,
  onEnterPlayback,
}: PlaybackControlsProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_DURATION_MINUTES);

  const snapshotsRef = useRef<PlaybackSnapshot[]>([]);
  const animFrameRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);
  const currentTimeRef = useRef<number>(0);
  const lastStateUpdateRef = useRef<number>(0);

  // Keep ref in sync
  currentTimeRef.current = currentTime;

  const findSnapshotAtTime = useCallback(
    (time: number): PlaybackSnapshot["aircraft"] => {
      const snapshots = snapshotsRef.current;
      if (snapshots.length === 0) return [];

      // Find the closest snapshot at or before this time
      let left = 0;
      let right = snapshots.length - 1;
      let bestIdx = 0;

      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        if (snapshots[mid].timestamp <= time) {
          bestIdx = mid;
          left = mid + 1;
        } else {
          right = mid - 1;
        }
      }

      const current = snapshots[bestIdx];
      const next = snapshots[bestIdx + 1];

      // If there is no next snapshot or time exactly matches, return current
      if (!next || current.timestamp === time) {
        return current.aircraft;
      }

      // Interpolate positions between current and next snapshot
      const progress =
        (time - current.timestamp) / (next.timestamp - current.timestamp);

      if (progress <= 0) return current.aircraft;
      if (progress >= 1) return next.aircraft;

      // Build interpolated aircraft list
      const interpolated: PlaybackSnapshot["aircraft"] = [];
      const nextMap = new Map(next.aircraft.map((a) => [a.hex, a]));

      for (const ac of current.aircraft) {
        const nextAc = nextMap.get(ac.hex);
        if (nextAc) {
          interpolated.push({
            hex: ac.hex,
            lat: ac.lat + (nextAc.lat - ac.lat) * progress,
            lon: ac.lon + (nextAc.lon - ac.lon) * progress,
            altitude:
              ac.altitude !== null && nextAc.altitude !== null
                ? Math.round(
                    ac.altitude + (nextAc.altitude - ac.altitude) * progress
                  )
                : nextAc.altitude ?? ac.altitude,
            heading: interpolateHeading(ac.heading, nextAc.heading, progress),
            speed:
              ac.speed !== null && nextAc.speed !== null
                ? ac.speed + (nextAc.speed - ac.speed) * progress
                : nextAc.speed ?? ac.speed,
            squawk: nextAc.squawk ?? ac.squawk,
            flight: nextAc.flight ?? ac.flight,
          });
        } else {
          // Aircraft not in next snapshot - show it fading out (still include)
          interpolated.push(ac);
        }
      }

      // Add aircraft that appear only in next snapshot (new arrivals)
      // Use a Set for O(1) lookups instead of O(n) find() per iteration
      const currentHexSet = new Set(current.aircraft.map((c) => c.hex));
      for (const ac of next.aircraft) {
        if (!currentHexSet.has(ac.hex)) {
          if (progress > 0.5) {
            interpolated.push(ac);
          }
        }
      }

      return interpolated;
    },
    []
  );

  // Animation loop for playback
  // The actual time tracking uses refs for precision. React state (setCurrentTime)
  // is throttled to ~12-15fps (every 70ms) to avoid excessive re-renders for the slider UI.
  useEffect(() => {
    if (!isPlayback || !isPlaying) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = 0;
      }
      return;
    }

    lastTickRef.current = performance.now();
    lastStateUpdateRef.current = performance.now();

    const tick = (now: number) => {
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      const newTime = currentTimeRef.current + delta * speed;

      if (newTime >= endTime) {
        currentTimeRef.current = endTime;
        setCurrentTime(endTime);
        setIsPlaying(false);
        const aircraft = findSnapshotAtTime(endTime);
        onPlaybackUpdate(aircraft, endTime);
        return;
      }

      // Update the ref immediately (used for precise timing calculations)
      currentTimeRef.current = newTime;

      // Call the playback update callback every frame for smooth map rendering
      const aircraft = findSnapshotAtTime(newTime);
      onPlaybackUpdate(aircraft, newTime);

      // Throttle React state updates to ~12-15fps for the slider/time display
      if (now - lastStateUpdateRef.current >= 70) {
        setCurrentTime(newTime);
        lastStateUpdateRef.current = now;
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlayback, isPlaying, speed, endTime, findSnapshotAtTime, onPlaybackUpdate]);

  const loadHistory = useCallback(async (minutes: number) => {
    setIsLoading(true);
    setError(null);

    const to = new Date();
    const from = new Date(to.getTime() - minutes * 60 * 1000);

    try {
      const response = await fetch(
        `/api/map/history?from=${from.toISOString()}&to=${to.toISOString()}`
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }

      const data: PlaybackData = await response.json();

      if (data.snapshots.length === 0) {
        throw new Error("No historical data available for this time range");
      }

      snapshotsRef.current = data.snapshots;
      const start = data.snapshots[0].timestamp;
      const end = data.snapshots[data.snapshots.length - 1].timestamp;

      setStartTime(start);
      setEndTime(end);
      setCurrentTime(start);
      setIsPlaying(false);

      // Show the first frame
      onPlaybackUpdate(data.snapshots[0].aircraft, start);
      onEnterPlayback();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setIsLoading(false);
    }
  }, [onPlaybackUpdate, onEnterPlayback]);

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseInt(e.target.value);
      setCurrentTime(time);
      const aircraft = findSnapshotAtTime(time);
      onPlaybackUpdate(aircraft, time);
    },
    [findSnapshotAtTime, onPlaybackUpdate]
  );

  const handleGoLive = useCallback(() => {
    setIsPlaying(false);
    snapshotsRef.current = [];
    onPlaybackEnd();
  }, [onPlaybackEnd]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const cycleSpeed = useCallback(() => {
    setSpeed((prev) => {
      const idx = SPEED_OPTIONS.indexOf(prev);
      return SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    });
  }, []);

  const formatTime = (ms: number) => {
    const date = new Date(ms);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Non-playback mode: show the "History" button
  if (!isPlayback) {
    return (
      <div className="absolute bottom-8 right-4 flex flex-col items-end gap-2">
        <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg border border-gray-700 shadow-xl">
          <div className="flex items-center gap-2 px-3 py-2">
            <select
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(parseInt(e.target.value))}
              className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Playback duration"
            >
              <option value="5">5 min</option>
              <option value="10">10 min</option>
              <option value="15">15 min</option>
              <option value="30">30 min</option>
              <option value="60">60 min</option>
            </select>
            <button
              onClick={() => loadHistory(durationMinutes)}
              disabled={isLoading}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-xs font-medium px-3 py-1.5 rounded transition-colors"
              aria-label="Enter historical playback mode"
            >
              {isLoading ? (
                <span className="animate-pulse">Loading...</span>
              ) : (
                <>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  History
                </>
              )}
            </button>
          </div>
          {error && (
            <div className="px-3 pb-2 text-xs text-red-400">{error}</div>
          )}
        </div>
      </div>
    );
  }

  // Playback mode: full controls
  const progress =
    endTime > startTime
      ? ((currentTime - startTime) / (endTime - startTime)) * 100
      : 0;

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[min(95vw,600px)] z-20" role="group" aria-label="Historical playback controls">
      <div className="bg-gray-900/95 backdrop-blur-sm rounded-lg border border-gray-700 shadow-xl px-4 py-3">
        {/* Top row: time display */}
        <div className="flex items-center justify-between mb-2 text-xs text-gray-300 font-mono tabular-nums">
          <span>{formatTime(startTime)}</span>
          <span className="text-white font-medium text-sm">
            {formatTime(currentTime)}
          </span>
          <span>{formatTime(endTime)}</span>
        </div>

        {/* Timeline slider */}
        <div className="relative mb-3">
          <div className="absolute inset-0 h-1.5 bg-gray-700 rounded-full top-1/2 -translate-y-1/2" />
          <div
            className="absolute h-1.5 bg-blue-500 rounded-full top-1/2 -translate-y-1/2"
            style={{ width: `${progress}%` }}
          />
          <input
            type="range"
            min={startTime}
            max={endTime}
            value={currentTime}
            onChange={handleSliderChange}
            className="relative w-full h-4 appearance-none bg-transparent cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-md"
            aria-label="Playback timeline"
            aria-valuetext={formatTime(currentTime)}
          />
        </div>

        {/* Bottom row: controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Play/Pause */}
            <button
              onClick={handlePlayPause}
              className="w-8 h-8 flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-white rounded-full transition-colors"
              aria-label={isPlaying ? "Pause playback" : "Play playback"}
            >
              {isPlaying ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              )}
            </button>

            {/* Speed control */}
            <button
              onClick={cycleSpeed}
              className="h-7 px-2.5 bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium rounded transition-colors tabular-nums"
              aria-label={`Playback speed: ${speed}x. Click to change.`}
            >
              {speed}x
            </button>
          </div>

          {/* Playback indicator */}
          <div className="flex items-center gap-1.5 text-xs text-amber-400" role="status" aria-live="polite">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-medium">PLAYBACK</span>
          </div>

          {/* Live button */}
          <button
            onClick={handleGoLive}
            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded transition-colors"
            aria-label="Return to live view"
          >
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            LIVE
          </button>
        </div>
      </div>
    </div>
  );
}

/** Interpolate heading angles correctly (handling 360/0 wrap) */
function interpolateHeading(
  from: number | null,
  to: number | null,
  progress: number
): number | null {
  if (from === null || to === null) return to ?? from;

  let diff = to - from;
  // Take the shortest path around the circle
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  let result = from + diff * progress;
  if (result < 0) result += 360;
  if (result >= 360) result -= 360;
  return result;
}
