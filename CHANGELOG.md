# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Historical playback for the live aircraft map with timeline slider, play/pause, speed control (1x/2x/5x/10x), smooth position interpolation between snapshots, flight trails during playback, and a "LIVE" button to return to real-time view
- `AircraftPosition` Prisma model for storing periodic aircraft position snapshots (hex, lat, lon, altitude, heading, speed, squawk, flight, timestamp)
- History recorder script (`scripts/history-recorder.ts`) that saves aircraft positions every 10 seconds via the internal snapshot API
- History cleanup script (`scripts/history-cleanup.ts`) for database maintenance with configurable retention period
- Public history API endpoint (`GET /api/v1/history?from=&to=&hex=`) with time-range validation, rate limiting, and optional hex filtering
- Internal map history API (`GET /api/map/history?from=&to=`) for the playback UI
- Internal snapshot API (`POST /api/internal/history-snapshot`) protected by `INTERNAL_CRON_SECRET`
- Aircraft type icons on the live map: distinct silhouettes for jets (A3-A6), turboprops (A2), helicopters (A7), light aircraft (A1/B1/B4), and a generic fallback for unknown categories. Icons rotate based on aircraft heading and are colored by altitude using Mapbox SDF rendering.
- Category-to-icon mapping from ICAO ADS-B emitter category codes with data-driven Mapbox expressions for per-aircraft icon selection
- Icons scale dynamically for selected and emergency aircraft states

### Security
- Auth bypass fixed on internal history-snapshot endpoint: requires `INTERNAL_CRON_SECRET` in production
- Removed GET handler on `/api/internal/history-snapshot` write endpoint (CSRF prevention)
- Timing-safe comparison for internal cron secret validation
- API key authentication added to `/api/v1/history` (was previously IP-only)
- Hex parameter validation on history endpoints (rejects invalid ICAO hex codes)
- readsb data validation before database insert (hex format check, lat/lon range validation)

### Fixed
- Removed redundant `@@index([timestamp, hex])` from AircraftPosition schema (duplicate of existing composite index)
- Added `take: 100000` safety limit on map/history query to prevent unbounded result sets
- Added `from >= to` validation on map/history route to reject invalid time ranges
- Reduced `PLAYBACK_MAX_TRAIL_POINTS` from 10000 to 2000 in playback mode for better performance

### Changed
- Direct Mapbox source updates during playback bypass React state for 60fps rendering
- Removed `selectedHex` from GeoJSON `useMemo` dependencies (uses separate Mapbox layer with filter instead)
- Replaced O(n^2) interpolation lookup with Set-based approach
- Removed `playbackTime` from `trailGeojson` dependencies (uses version counter ref)
- Pulse animation for emergencies gated on `emergencyCount > 0` (avoids unnecessary animation frames)
- Extracted `onToggle` to `useCallback` for stable reference
- Debounced `handleMoveEnd` callback (500ms) to reduce map event processing
- Replaced redundant `emergencyCount` memo with `emergencyGeojson.features.length`
- Throttled playback `setCurrentTime` to ~12-15fps for smoother UI updates
- Map container: added `role="application"` and `aria-label` for screen reader context
- Stats overlay: added `role="status"`, `aria-live="polite"`, `aria-atomic` for dynamic updates
- Playback controls: added `role="group"`, `aria-label`, `aria-valuetext` on slider
- PLAYBACK indicator: added `role="status"` and `aria-live="polite"`
- Focus-visible styles on range input and duration buttons for keyboard navigation
