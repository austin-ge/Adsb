# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Redis-backed rate limiting via Upstash with in-memory fallback for distributed request throttling
- Sentry error tracking integration with `@sentry/nextjs` for client, server, and edge runtime
- Test coverage with Vitest configuration and test suite in `__tests__/api/` directory
- GitHub Actions CI workflow (`.github/workflows/ci.yml`) for automated testing and build validation
- `npm run test` and `npm run test:run` scripts for running test suite
- Global error boundary at `app/global-error.tsx` for catching and reporting unhandled errors to Sentry
- Sentry configuration files: `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
- Sentry utility helpers at `lib/sentry.ts` for error tracking and reporting
- Landing page redesign (`app/page.tsx`) with animated number counters, live stats from `/api/v1/stats`, and dark aviation theme
- Component refactoring: extracted 10 feeder-specific components in `components/feeder/` directory
- Component refactoring: extracted 7 map-specific components in `components/map/` directory
- Feeder enrollment token flow with 1-hour expiry and single-use enforcement for secure Pi registration
- New enrollment endpoint: `POST /api/v1/feeders/[uuid]/enroll` for Pi self-registration using enrollment tokens
- New dashboard endpoint: `POST /api/feeders/[id]/regenerate-enrollment` for refreshing enrollment tokens
- Enrollment token and expiry fields to Feeder model (`enrollmentToken`, `enrollmentExpires`)
- Connection pooling support via `lib/prisma-worker.ts` for dedicated worker database connections
- Optional `WORKER_DATABASE_URL` environment variable for worker process database scaling
- Health check endpoint: `GET /api/health` for deployment monitoring and readiness verification
- Share button on feeder detail page - copies feeder page URL to clipboard
- 7-Day Summary table on feeder detail page - shows daily aggregated stats (messages, positions, aircraft count)
- Nearby Airports section on feeder detail page - displays 5 closest airports with distances
- Monthly Summary card on feeder detail page - shows this month's aggregated statistics
- `Dockerfile.worker` for running background workers as separate Dokploy service
- `docker-entrypoint-worker.sh` for worker container startup and initialization
- `ecosystem.config.js` for PM2 to manage 4 worker processes (stats-worker, history-recorder, history-cleanup, flight-segmenter)
- `npm run workers` development script for running all workers concurrently using concurrently
- Dotenv support in worker scripts for proper .env file loading in containerized environments
- Feeder scoring system (0-100 composite score based on uptime, message rate, position rate, and aircraft count)
- Range tracking (max range and 24-hour average calculated from heartbeat aircraft positions)
- Feeder rankings with change indicators (↑↓ showing score movement)
- 7-day uptime visualization chart on feeder detail page
- Range history chart (max range and average range) on feeder detail page
- Recent flights section on feeder detail page
- Leaderboard search functionality (filter feeders by name)
- Leaderboard sort by score, max range, and average range
- Score and max range columns on leaderboard display
- Geo utility library (lib/geo.ts) with haversine distance calculation for range determination
- `browser-tester` review agent for visual testing with screenshots, interaction checks, and console error detection (uses `agent-browser` skill)
- Three-layer Claude workflow: Skills → Review Agents → Task Subagents (optimized for context efficiency)
- Installed `agent-browser` CLI globally for browser automation
- **All Aircraft Trails** layer: toggleable option in Map Layers panel showing 2-minute trail segments for all visible aircraft
- Dark/light mode toggle with system preference support (Light/Dark/Auto in Layers panel)
- Receiver coverage heatmap layer showing historical position density
- Metric/imperial units toggle with conversions for altitude (ft/m), speed (kts/km/h), and distance (nm/km)
- URL sharing for aircraft selection (map links include `?aircraft=HEX` param to persist selected aircraft)
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
- Airport markers layer showing major airports with ICAO codes on the map (toggleable via Map Layers panel)
- Map style selector with 4 options: Streets, Satellite, Dark, Light (independent from UI theme)
- New airport data file at `public/data/airports.json` with 139 major airports worldwide

### Changed
- Rate limiting is now async and properly distributed across multiple deployment instances via Upstash Redis
- Install script now uses secure enrollment token instead of heartbeat token for initial Pi registration
- Install script now includes aircraft positions in heartbeat payload for range calculation
- Stats worker now calculates scoring metrics (uptime, message rate, position rate) hourly
- Leaderboard default sort changed from messages received to composite score
- Feeder page component reduced from 1,030 to 332 lines through component extraction
- Map client component reduced from 1,280 to 1,006 lines through modular component decomposition

### Fixed
- Hoisted empty GeoJSON FeatureCollection as module-level constant to avoid object allocation on every render when trails disabled
- Replaced O(n) reverse iteration with O(log n) binary search for finding trail start index (significant perf improvement with many aircraft)
- Removed redundant `@@index([timestamp, hex])` from AircraftPosition schema (duplicate of existing composite index)
- Added `take: 100000` safety limit on map/history query to prevent unbounded result sets
- Added `from >= to` validation on map/history route to reject invalid time ranges
- Reduced `PLAYBACK_MAX_TRAIL_POINTS` from 10000 to 2000 in playback mode for better performance

### Changed
- Restructured agent system: Task subagents now handle implementation (saves context), review agents handle validation (project-specific rules)
- Archived domain agents (`api-developer`, `auth-developer`, `db-migrator`, `map-developer`, `ui-designer`) to `.claude/agents/archived/` - replaced by built-in Task subagents
- Updated `CLAUDE.md` and `docs/AGENTS.md` with new three-layer workflow documentation
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
- Map style is now independent from UI theme - users can choose any map style regardless of light/dark mode
- Map Layers panel reorganized: added Map Style section between Units and Theme sections

### Security
- Enrollment token flow replaces direct heartbeat token usage in install script for enhanced feeder security
- Enrollment tokens are single-use and expire after 1 hour to minimize compromise window
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
- Map style is now independent from UI theme - users can choose any map style regardless of light/dark mode
- Map Layers panel reorganized: added Map Style section between Units and Theme sections
