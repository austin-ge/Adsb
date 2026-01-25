"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useTheme } from "next-themes";
import { Layers, MapPin, Radio, X, Loader2, Sun, Moon, Monitor, Ruler, Flame } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { Switch } from "@/components/ui/switch";
import { fetcher } from "@/lib/fetcher";
import { useUnits, getRangeDistances } from "@/lib/units";

interface Feeder {
  id: string;
  uuid: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

type CenterSource = "my-location" | `feeder-${string}`;

type MapTheme = "dark" | "light" | "system";

interface MapControlsProps {
  onRangeRingsChange: (center: { lat: number; lng: number } | null) => void;
  onCoverageHeatmapChange: (enabled: boolean) => void;
  onThemeChange?: (theme: MapTheme) => void;
  offsetTop?: number;
}

const STORAGE_KEY = "hangartrak-map-controls";

interface StoredPreferences {
  rangeRingsEnabled: boolean;
  centerSource: CenterSource;
  myLocation: { lat: number; lng: number } | null;
  coverageHeatmapEnabled: boolean;
}

function loadPreferences(): Partial<StoredPreferences> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return {};
}

function savePreferences(prefs: StoredPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage errors
  }
}

function RangeRingsInfo({ isLoggedIn }: { isLoggedIn: boolean }) {
  const { units, distanceUnitShort } = useUnits();
  const distances = getRangeDistances(units);

  return (
    <div className="text-xs text-gray-500 leading-relaxed">
      Range rings show distances at {distances.join(", ")} {distanceUnitShort}.
      {!isLoggedIn && (
        <span className="block mt-1">
          <a href="/login" className="text-blue-400 hover:underline">
            Sign in
          </a>{" "}
          to use your feeder location.
        </span>
      )}
    </div>
  );
}

function UnitsSection() {
  const { units, setUnits, distanceUnitShort, speedUnitShort, altitudeUnitShort } = useUnits();

  return (
    <div className="p-4 border-t border-gray-700 space-y-3">
      <div className="flex items-center gap-2">
        <Ruler className="w-4 h-4 text-blue-400" />
        <span className="text-sm text-gray-200">Units</span>
      </div>

      {/* Unit system toggle */}
      <div className="flex rounded-lg overflow-hidden border border-gray-600">
        <button
          onClick={() => setUnits("imperial")}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            units === "imperial"
              ? "bg-blue-600 text-white"
              : "bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
          }`}
          aria-pressed={units === "imperial"}
        >
          Imperial
        </button>
        <button
          onClick={() => setUnits("metric")}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            units === "metric"
              ? "bg-blue-600 text-white"
              : "bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
          }`}
          aria-pressed={units === "metric"}
        >
          Metric
        </button>
      </div>

      {/* Current units info */}
      <div className="text-xs text-gray-500 leading-relaxed">
        {units === "imperial" ? (
          <>Altitude: {altitudeUnitShort} | Speed: {speedUnitShort} | Distance: {distanceUnitShort}</>
        ) : (
          <>Altitude: {altitudeUnitShort} | Speed: {speedUnitShort} | Distance: {distanceUnitShort}</>
        )}
      </div>
    </div>
  );
}

export function MapControls({ onRangeRingsChange, onCoverageHeatmapChange, onThemeChange, offsetTop = 0 }: MapControlsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rangeRingsEnabled, setRangeRingsEnabled] = useState(false);
  const [centerSource, setCenterSource] = useState<CenterSource>("my-location");
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [coverageHeatmapEnabled, setCoverageHeatmapEnabled] = useState(false);

  // Theme management
  const { theme, setTheme, resolvedTheme } = useTheme();

  // Track mount state to avoid hydration mismatch with theme
  useEffect(() => {
    setMounted(true);
  }, []);

  // Notify parent when theme changes
  useEffect(() => {
    if (mounted && onThemeChange) {
      onThemeChange(theme as MapTheme);
    }
  }, [theme, mounted, onThemeChange]);

  // Check if user is authenticated
  const { data: session, isPending: isSessionLoading } = useSession();
  const isLoggedIn = !!session?.user;

  // Fetch user's feeders if logged in
  const { data: feeders } = useSWR<Feeder[]>(
    isLoggedIn ? "/api/feeders" : null,
    fetcher
  );

  // Filter feeders that have location set (memoized for stable dependency)
  const feedersWithLocation = useMemo(
    () => feeders?.filter((f) => f.latitude !== null && f.longitude !== null) ?? [],
    [feeders]
  );

  // Load preferences on mount
  useEffect(() => {
    const prefs = loadPreferences();
    if (prefs.rangeRingsEnabled !== undefined) {
      setRangeRingsEnabled(prefs.rangeRingsEnabled);
    }
    if (prefs.centerSource) {
      setCenterSource(prefs.centerSource);
    }
    if (prefs.myLocation) {
      setMyLocation(prefs.myLocation);
    }
    if (prefs.coverageHeatmapEnabled !== undefined) {
      setCoverageHeatmapEnabled(prefs.coverageHeatmapEnabled);
      onCoverageHeatmapChange(prefs.coverageHeatmapEnabled);
    }
  }, [onCoverageHeatmapChange]);

  // Update range rings center when settings change
  useEffect(() => {
    if (!rangeRingsEnabled) {
      onRangeRingsChange(null);
      return;
    }

    if (centerSource === "my-location") {
      onRangeRingsChange(myLocation);
    } else if (centerSource.startsWith("feeder-")) {
      const feederId = centerSource.replace("feeder-", "");
      const feeder = feedersWithLocation.find((f) => f.id === feederId);
      if (feeder && feeder.latitude !== null && feeder.longitude !== null) {
        onRangeRingsChange({ lat: feeder.latitude, lng: feeder.longitude });
      } else {
        onRangeRingsChange(null);
      }
    }
  }, [rangeRingsEnabled, centerSource, myLocation, feedersWithLocation, onRangeRingsChange]);

  // Save preferences when they change
  useEffect(() => {
    savePreferences({
      rangeRingsEnabled,
      centerSource,
      myLocation,
      coverageHeatmapEnabled,
    });
  }, [rangeRingsEnabled, centerSource, myLocation, coverageHeatmapEnabled]);

  const handleGetLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      return;
    }

    setIsGettingLocation(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setMyLocation(location);
        setIsGettingLocation(false);
        setCenterSource("my-location");
      },
      (error) => {
        setIsGettingLocation(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError("Location permission denied");
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError("Location unavailable");
            break;
          case error.TIMEOUT:
            setLocationError("Location request timed out");
            break;
          default:
            setLocationError("Failed to get location");
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 600000, // Cache for 10 minutes
      }
    );
  }, []);

  const handleToggleRangeRings = useCallback((checked: boolean) => {
    setRangeRingsEnabled(checked);
    // If enabling and no location yet, try to get it
    if (checked && !myLocation && centerSource === "my-location") {
      handleGetLocation();
    }
  }, [myLocation, centerSource, handleGetLocation]);

  const handleSourceChange = useCallback((source: CenterSource) => {
    setCenterSource(source);
    // If selecting my-location and no location yet, try to get it
    if (source === "my-location" && !myLocation) {
      handleGetLocation();
    }
  }, [myLocation, handleGetLocation]);

  const handleToggleCoverageHeatmap = useCallback((checked: boolean) => {
    setCoverageHeatmapEnabled(checked);
    onCoverageHeatmapChange(checked);
  }, [onCoverageHeatmapChange]);

  const topPosition = 16 + offsetTop; // 16px = top-4

  return (
    <div
      className="absolute right-4 z-10 transition-[top] duration-200"
      style={{ top: `${topPosition}px` }}
    >
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-10 h-10 bg-gray-900/90 backdrop-blur-sm rounded-lg border border-gray-700 shadow-xl text-gray-300 hover:text-white hover:bg-gray-800/90 transition-colors"
        aria-label="Map layers and controls"
        aria-expanded={isOpen}
      >
        <Layers className="w-5 h-5" />
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="absolute top-12 right-0 w-72 bg-gray-900/95 backdrop-blur-sm rounded-lg border border-gray-700 shadow-xl overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Map Layers</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Layers Section */}
          <div className="p-4 space-y-4">
            {/* Coverage Heatmap Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-400" />
                <span className="text-sm text-gray-200">Receiver Coverage</span>
              </div>
              <Switch
                checked={coverageHeatmapEnabled}
                onCheckedChange={handleToggleCoverageHeatmap}
                aria-label="Toggle receiver coverage heatmap"
              />
            </div>

            {/* Coverage info text */}
            {coverageHeatmapEnabled && (
              <div className="text-xs text-gray-500 leading-relaxed pl-6">
                Shows density of received aircraft positions over the last 24 hours. Brighter areas indicate better coverage.
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-gray-700" />

            {/* Range Rings Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-gray-200">Range Rings</span>
              </div>
              <Switch
                checked={rangeRingsEnabled}
                onCheckedChange={handleToggleRangeRings}
                aria-label="Toggle range rings"
              />
            </div>

            {/* Center Source Selection */}
            {rangeRingsEnabled && (
              <div className="space-y-2 pl-6">
                <label className="text-xs text-gray-400 uppercase tracking-wide">
                  Center Point
                </label>

                {/* My Location option */}
                <button
                  onClick={() => handleSourceChange("my-location")}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-sm transition-colors ${
                    centerSource === "my-location"
                      ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700 border border-transparent"
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                  <span className="flex-1">My Location</span>
                  {centerSource === "my-location" && myLocation && (
                    <span className="text-xs text-gray-400">
                      {myLocation.lat.toFixed(2)}, {myLocation.lng.toFixed(2)}
                    </span>
                  )}
                  {centerSource === "my-location" && !myLocation && isGettingLocation && (
                    <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                  )}
                </button>

                {/* Location error message */}
                {locationError && centerSource === "my-location" && (
                  <div className="text-xs text-red-400 px-3">{locationError}</div>
                )}

                {/* Retry location button */}
                {centerSource === "my-location" && !myLocation && !isGettingLocation && (
                  <button
                    onClick={handleGetLocation}
                    className="w-full text-xs text-blue-400 hover:text-blue-300 px-3 py-1 text-left"
                  >
                    {locationError ? "Retry getting location" : "Get my location"}
                  </button>
                )}

                {/* Feeder options - only shown to logged-in users */}
                {isSessionLoading ? (
                  <div className="px-3 py-2 text-xs text-gray-500">Loading...</div>
                ) : isLoggedIn && feedersWithLocation.length > 0 ? (
                  <>
                    <div className="border-t border-gray-700 mt-2 pt-2">
                      <span className="text-xs text-gray-500 px-3">My Feeders</span>
                    </div>
                    {feedersWithLocation.map((feeder) => (
                      <button
                        key={feeder.id}
                        onClick={() => handleSourceChange(`feeder-${feeder.id}`)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-sm transition-colors ${
                          centerSource === `feeder-${feeder.id}`
                            ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                            : "bg-gray-800 text-gray-300 hover:bg-gray-700 border border-transparent"
                        }`}
                      >
                        <Radio className="w-4 h-4" />
                        <span className="flex-1 truncate">{feeder.name}</span>
                        {centerSource === `feeder-${feeder.id}` && feeder.latitude && (
                          <span className="text-xs text-gray-400">
                            {feeder.latitude.toFixed(2)}, {feeder.longitude?.toFixed(2)}
                          </span>
                        )}
                      </button>
                    ))}
                  </>
                ) : isLoggedIn ? (
                  <div className="px-3 py-2 text-xs text-gray-500">
                    No feeders with location set.{" "}
                    <a href="/dashboard/feeders" className="text-blue-400 hover:underline">
                      Add feeder location
                    </a>
                  </div>
                ) : null}
              </div>
            )}

            {/* Info text */}
            <RangeRingsInfo isLoggedIn={isLoggedIn} />
          </div>

          {/* Units Section */}
          <UnitsSection />

          {/* Theme Section */}
          <ThemeSection mounted={mounted} theme={theme} setTheme={setTheme} resolvedTheme={resolvedTheme} />
        </div>
      )}
    </div>
  );
}

interface ThemeSectionProps {
  mounted: boolean;
  theme: string | undefined;
  setTheme: (theme: string) => void;
  resolvedTheme: string | undefined;
}

function ThemeSection({ mounted, theme, setTheme, resolvedTheme }: ThemeSectionProps) {
  return (
    <div className="p-4 border-t border-gray-700 space-y-3">
      <div className="flex items-center gap-2">
        {mounted && resolvedTheme === "dark" ? (
          <Moon className="w-4 h-4 text-blue-400" />
        ) : (
          <Sun className="w-4 h-4 text-amber-400" />
        )}
        <span className="text-sm text-gray-200">Map Theme</span>
      </div>

      {/* Theme toggle buttons */}
      <div className="flex rounded-lg overflow-hidden border border-gray-600">
        <button
          onClick={() => setTheme("light")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium transition-colors ${
            mounted && theme === "light"
              ? "bg-amber-600 text-white"
              : "bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
          }`}
          aria-pressed={mounted && theme === "light"}
          aria-label="Light theme"
        >
          <Sun className="w-3 h-3" />
          Light
        </button>
        <button
          onClick={() => setTheme("dark")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium transition-colors ${
            mounted && theme === "dark"
              ? "bg-blue-600 text-white"
              : "bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
          }`}
          aria-pressed={mounted && theme === "dark"}
          aria-label="Dark theme"
        >
          <Moon className="w-3 h-3" />
          Dark
        </button>
        <button
          onClick={() => setTheme("system")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium transition-colors ${
            mounted && theme === "system"
              ? "bg-purple-600 text-white"
              : "bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
          }`}
          aria-pressed={mounted && theme === "system"}
          aria-label="System theme (follows OS preference)"
        >
          <Monitor className="w-3 h-3" />
          Auto
        </button>
      </div>
    </div>
  );
}
