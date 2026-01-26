# Changelog

All notable changes to HangarTrak Radar will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added
- Development roadmap (`docs/ROADMAP.md`) based on competitive analysis of FlightRadar24 and AirNav RadarBox
  - Phase 7: Feeder Dashboard Enhancement (scoring, range tracking, uptime viz)
  - Phase 8: Map Feature Parity (data sources, estimation, day/night)
  - Phase 9: Advanced Filtering (categories, altitude/speed, presets)
  - Phase 10: Weather Integration (radar, clouds)
  - Phase 11: UX Polish (units, keyboard shortcuts, export)
  - Phase 12: API & Integration (docs, HangarTrak, WebSocket)
- Competitive technical analysis section in roadmap documenting:
  - FR24 tech stack: Vue.js 3, gRPC-web (Protocol Buffers), deck.gl (WebGL), Dexie.js (IndexedDB)
  - RadarBox tech stack: React, OpenLayers 10.4.0, H3 hexagonal indexing, Axios
  - Data feed comparison: FR24 uses ~6s polling with ~45KB protobuf payloads
  - Technical recommendations: gzip compression, sprite sheets, IndexedDB caching, H3 for coverage

### Fixed
- Database schema migration: added `apiKeyHash`, `apiKeyPrefix` columns to `user` table (replacing old `apiKey`) and `heartbeatToken` to `Feeder` table
- Map aircraft icons not rendering after dynamic import refactor — replaced unreliable `onLoad` callback with polling `useEffect` that waits for map readiness before adding custom SDF icon
- Password reset now uses Better Auth's native `hashPassword` (`@noble/hashes/scrypt` with N:16384, r:16, p:1)

### Added
- Aircraft list sidebar on map page with search filtering, sortable columns (callsign, altitude, speed, squawk, distance), click-to-fly-to selection, and collapsible panel
- Live aircraft map page with Mapbox visualization and altitude-based color coding
- Map API endpoint (`/api/map/aircraft`) for frontend map data
- Emergency squawk highlighting (7500/7600/7700) with pulsing rings, color override, enlarged icons, info panel banner, legend entries, and stats counter
- Heartbeat token authentication for feeder stats reporting (Bearer token in Authorization header)
- Rate limiting on heartbeat endpoint (10 req/min per feeder) and map endpoint (60 req/min per IP)
- Input validation for feeder names (alphanumeric + safe chars, max 64 chars) and coordinates (lat/lng bounds)
- Global `prefers-reduced-motion` support in CSS (disables all animations for users who prefer reduced motion)
- Skip-to-main-content links in root and dashboard layouts for keyboard navigation
- `aria-hidden="true"` on all decorative icons (~50 instances across 11 files)
- `aria-label` on all icon-only buttons (copy, close, sidebar toggle, user menu)
- `aria-live="polite"` on form error messages for screen reader announcements
- `autoComplete` attributes on all auth form inputs (email, password, name)
- `focus-visible:ring` focus styles on map sidebar search and sort controls
- `content-visibility: auto` on aircraft sidebar list items for rendering performance
- `overscroll-behavior: contain` on dialog and scrollable sidebar
- `<meta name="theme-color">` and `color-scheme` on HTML root
- `tabular-nums` on all numeric stat displays for consistent alignment
- `text-wrap: balance` on page headings
- Shared `lib/fetcher.ts` with error handling for SWR data fetching
- Shared `lib/format.ts` with `formatNumber()` utility
- Exported `Session` and `User` types from Better Auth `$Infer`
- Coding standards section in `CLAUDE.md` referencing Vercel React, Better Auth, and Web Interface Guidelines skills

### Changed
- API keys are now stored as SHA-256 hashes in the database (plaintext key shown only once on generation)
- Install script sanitizes feeder names before embedding in shell scripts to prevent command injection
- Feeder creation generates a unique `heartbeatToken` stored on the Pi during install
- Stats API route now runs all 7 queries in parallel via `Promise.all()` (3-5x faster)
- Heartbeat route runs feeder update and user tier upgrade in parallel
- `getServerSession` wrapped in `React.cache()` for per-request deduplication
- `fetchAircraftData` wrapped in `React.cache()` to prevent duplicate fetches
- Map page uses SWR with `refreshInterval: 1000` instead of raw `setInterval`
- Map page pulse animation uses `requestAnimationFrame` + Mapbox API instead of React state (eliminates 20 re-renders/sec)
- Map page callbacks stabilized with refs and functional setState (no unnecessary re-renders)
- Map page loaded via `next/dynamic` with `ssr: false` (700KB mapbox-gl deferred)
- Stats page charts loaded via `next/dynamic` (200KB recharts deferred)
- Added `optimizePackageImports` for `lucide-react` and `recharts` in `next.config.ts`
- Leaderboard filters (period, sort) now synced to URL query params (shareable, back-button works)
- All loading text uses proper Unicode ellipsis character (\u2026) instead of three dots
- Removed 6 duplicate `fetcher` function declarations across dashboard pages
- Removed 5 duplicate `formatNumber` function declarations across dashboard pages
- Better Auth: added `advanced.useSecureCookies` for production
- Better Auth: added rate limiting (10 req/60s) on auth endpoints
- Better Auth: fixed `trustedOrigins` to not fall back to localhost in production

---

## [0.2.0] - 2026-01-20

### Added
- Feeder self-reporting via heartbeat API (`POST /api/v1/feeders/:uuid/heartbeat`)
- Automatic tier upgrade (FREE → FEEDER) on first heartbeat
- Feeder stats reporter script template (`scripts/feeder-stats.sh`)
- Leaderboard page ranking feeders by contribution
- API documentation page stub
- Network statistics page

### Changed
- Rebranded from "ADS-B Aggregator" to "HangarTrak Radar"
- Updated navigation and landing page with HangarTrak branding
- Feeder detail page now shows live heartbeat stats

---

## [0.1.0] - 2026-01-18

### Added
- Initial project setup with Next.js 16, TypeScript, Tailwind CSS
- PostgreSQL database with Prisma ORM schema
- Better Auth integration (email/password login & registration)
- User dashboard with network statistics
- Feeder registration and management (CRUD)
- Personalized install script generation (`/api/install/[uuid]`)
- Public API v1 endpoints:
  - `GET /api/v1/aircraft` - Live aircraft data with filtering
  - `GET /api/v1/aircraft/[hex]` - Single aircraft lookup
  - `GET /api/v1/stats` - Network statistics
  - `GET /api/v1/feeders` - Feeder list (tier-restricted)
- API key generation and tier-based rate limiting
- Docker aggregator setup (readsb + tar1090)
- Landing page with feature showcase
- shadcn/ui component library integration

---

*This changelog is updated with every feature addition or significant change.*
