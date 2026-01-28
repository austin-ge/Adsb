# HangarTrak Radar - Project Specification

## 1. Overview

**Project:** HangarTrak Radar
**Repository:** adsb
**Purpose:** Community-powered ADS-B feeder network that aggregates aircraft tracking data from distributed Raspberry Pi devices, replacing the adsb.lol dependency in HangarTrak.

**Domain Architecture:**
- `radar.hangartrak.com` - Feeder registration & dashboard (this app)
- `map.hangartrak.com` - tar1090 live aircraft map
- `api.hangartrak.com/v1/` - Public aircraft API

---

## 2. System Architecture

### Components

| Service | Technology | Purpose |
|---------|-----------|---------|
| Web App | Next.js 16 (App Router) | Dashboard, feeder management, API |
| Aggregator | readsb + tar1090 (Docker) | Beast protocol ingestion, JSON output |
| Database | PostgreSQL + Prisma ORM | User accounts, feeder data, stats |
| Auth | Better Auth | Email/password authentication |

### Data Flow

```
Raspberry Pi (readsb)
    ↓ Beast Protocol (TCP :30004)
HangarTrak Radar Aggregator (readsb)
    ↓ JSON
Next.js API Layer
    ├── Dashboard UI
    ├── Public API v1 (aircraft, stats, history)
    ├── Live Map (Mapbox) with playback
    └── HangarTrak Integration
    ↓
PostgreSQL Database (users, feeders, stats, positions)
    ↑
History Recorder (scripts/history-recorder.ts, every 10s)
    ↑ reads readsb JSON via internal snapshot API
```

### Feeder Self-Reporting

Each Pi runs a stats reporter that POSTs to `/api/v1/feeders/:uuid/heartbeat` every 30 seconds:
- Aircraft count with positions
- Messages received (delta)
- Positions received (delta)

---

## 3. Tech Stack

### Frontend
- Next.js 16 with App Router
- React 19
- TypeScript 5.7
- Tailwind CSS
- shadcn/ui (Radix UI primitives)
- react-map-gl + Mapbox GL JS
- SWR (data fetching with dedup and revalidation)
- Lucide React (icons, tree-shaken via `optimizePackageImports`)
- next/dynamic (lazy loading for mapbox-gl, recharts)
- Sentry (@sentry/nextjs) for error tracking and monitoring
- Vitest for unit testing

### Backend
- Next.js API Routes
- Prisma ORM 6.0
- PostgreSQL
- Better Auth 1.0
- Zod (validation)
- Upstash Redis (distributed rate limiting)
- Sentry (@sentry/nextjs) for error tracking

### Infrastructure
- Docker (aggregator: readsb + tar1090)
- Dokploy on Hostinger VPS
- Node.js runtime

---

## 4. Database Schema

### Models

**User**
- id, name, email, password (hashed)
- apiKeyHash (unique, nullable) - SHA-256 hash of the API key
- apiKeyPrefix - First 14 chars for display
- tier: FREE | FEEDER | PRO
- Relations: feeders[], sessions[], accounts[]

**Feeder**
- id, uuid (unique), name
- latitude, longitude
- heartbeatToken (unique) - Bearer token for authenticating heartbeat requests
- enrollmentToken (unique, nullable) - Single-use token for Pi self-registration
- enrollmentExpires (nullable) - Expiry timestamp for enrollment token (1 hour from creation)
- isOnline, lastSeen
- messagesTotal, positionsTotal, aircraftSeen
- score (0-100) - Composite score based on uptime, message rate, position rate, aircraft count
- maxRange, avgRange - Range metrics calculated from aircraft positions
- userId (foreign key)
- Relations: stats[]

**FeederStats**
- id, feederId (foreign key)
- messages, positions, aircraftCount
- score (0-100) - Composite score at this snapshot
- maxRange, avgRange - Range metrics at this snapshot
- uptime (0-100) - Uptime percentage calculated hourly
- timestamp (indexed)

**AircraftPosition**
- id, hex (ICAO hex address)
- lat, lon (position)
- altitude (barometric, feet), heading (degrees), speed (knots)
- squawk, flight (callsign)
- timestamp (indexed; composite indexes on hex+timestamp and timestamp+hex)
- Populated every ~10s by history recorder; cleaned up by retention script (default 24h)

**Session, Account, Verification** - Better Auth managed tables

### API Tiers

| Tier | Rate Limit | Access Level |
|------|-----------|--------------|
| FREE | 100 req/min | Basic endpoints |
| FEEDER | 1000 req/min | Full API (auto-granted with active feeder) |
| PRO | 10000 req/min | Full API + priority support |

---

## 5. Page Structure

### Public Pages
| Route | Description |
|-------|------------|
| `/` | Landing page with feature showcase |
| `/login` | User login |
| `/register` | User registration |
| `/map` | Live aircraft map (Mapbox) with altitude coloring, canvas-rendered SDF aircraft type icons (jet/turboprop/helicopter/light/generic from ICAO emitter category), flight trails, emergency squawk highlighting, aircraft list sidebar (sortable, searchable, collapsible), historical playback (timeline slider, play/pause, 1x/2x/5x/10x speed, smooth interpolation with heading-aware rotation) |
| `/leaderboard` | Top feeders ranked by composite score (0-100) with filters, search, and sort by score/max range/avg range |
| `/docs/api` | API documentation |

### Dashboard Pages (authenticated)
| Route | Description |
|-------|------------|
| `/dashboard` | Overview with stats and feeder list |
| `/feeders` | Manage feeders |
| `/feeders/[id]` | Individual feeder detail with composite score (0-100), 7-day uptime chart, range history (max/avg), recent flights, share button, 7-day summary table, nearby airports (5 closest with distances), and monthly summary card |
| `/stats` | Network-wide statistics |
| `/api-keys` | API key generation & management |

---

## 6. API Specification

### Public API (`/api/v1/`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/aircraft` | API Key | All current aircraft (filterable) |
| GET | `/aircraft/[hex]` | API Key | Single aircraft by ICAO hex |
| GET | `/stats` | API Key | Network statistics |
| GET | `/history` | API Key | Historical positions (params: from, to, hex) |
| GET | `/feeders` | API Key | Feeder list (location restricted by tier) |
| POST | `/feeders/[uuid]/enroll` | Enrollment token | Pi self-registration to exchange enrollment token for heartbeat token (single-use, 1h expiry) |
| POST | `/feeders/[uuid]/heartbeat` | Bearer token | Feeder stats reporting with aircraft positions (rate limited: 10/min) |
| GET | `/feeders/[uuid]/heartbeat` | None | Feeder status check |

**Aircraft Filters:** bounds (N/S/E/W), altitude range, callsign
**History Params:** from/to (ISO 8601, max 60min range), hex (optional ICAO filter)

### Internal APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Deployment readiness check (no auth required) |
| GET | `/api/feeders` | User's feeders (authenticated) |
| POST | `/api/feeders` | Create new feeder |
| GET/DELETE | `/api/feeders/[id]` | Manage feeder |
| POST | `/api/feeders/[id]/regenerate-enrollment` | Refresh enrollment token for feeder |
| POST | `/api/user/api-key` | Generate API key |
| GET | `/api/install/[uuid]` | Personalized Pi install script |
| GET | `/api/leaderboard` | Leaderboard data (params: sort=score|maxRange|avgRange, search, limit) |
| GET | `/api/stats` | Network stats |
| GET | `/api/map/aircraft` | Aircraft for map visualization |
| GET | `/api/map/history` | Historical positions for map playback (params: from, to) |
| POST | `/api/internal/history-snapshot` | Record aircraft positions (auth: INTERNAL_CRON_SECRET, POST-only for CSRF prevention) |

---

## 7. Key Implementation Patterns

1. **Automatic Tier Upgrade:** First heartbeat from a feeder upgrades owner from FREE to FEEDER tier
2. **Location Privacy:** Feeder coordinates only exposed to FEEDER+ tier API consumers
3. **Rate Limiting:** Distributed rate limiting via Upstash Redis (fallback to in-memory), keyed by API key or IP, configurable per tier. Better Auth endpoints also rate-limited (10 req/60s).
4. **Install Scripts:** Personalized bash scripts generated per-feeder with embedded UUID, use enrollment token for initial registration
5. **Enrollment Token Flow:** Single-use tokens with 1-hour expiry for Pi self-registration, exchanged for heartbeat token on `/api/v1/feeders/[uuid]/enroll`
6. **Aircraft Data Pipeline:** readsb aggregates feeds → tar1090 JSON → Next.js API → clients
7. **Emergency Squawk Detection:** Aircraft with squawk 7500 (hijack), 7600 (radio failure), or 7700 (emergency) get color override, enlarged icons, pulsing rings, and info panel banners
8. **Server-Side Deduplication:** `React.cache()` wraps `getServerSession` and `fetchAircraftData` to prevent redundant calls within a single request
9. **Parallel Database Queries:** Stats and heartbeat routes use `Promise.all()` for independent queries
10. **Bundle Optimization:** Heavy libraries (mapbox-gl, recharts) loaded via `next/dynamic` with SSR disabled; `optimizePackageImports` eliminates barrel file costs
11. **Map Performance:** SWR for data polling, `requestAnimationFrame` for animations via Mapbox API (no React state churn), stable callbacks via refs, `content-visibility: auto` on list items, polling-based custom icon loading (avoids `onLoad` timing issues with dynamic imports), canvas-rendered SDF aircraft type icons (jet/turboprop/helicopter/light/generic) with per-feature icon selection via Mapbox expressions
12. **Accessibility:** WCAG-compliant with aria-hidden on decorative icons, aria-labels on controls, skip-nav links, proper focus indicators, reduced-motion support, semantic form attributes, map container `role="application"`, stats `aria-live="polite"`, playback controls `role="group"` with `aria-valuetext`, and focus-visible styles on interactive elements
13. **Shared Utilities:** `lib/fetcher.ts` (SWR fetcher with error handling) and `lib/format.ts` (number formatting) prevent code duplication
14. **Historical Playback:** Position snapshots stored every ~10s by external recorder script; map UI loads time ranges and interpolates aircraft positions between snapshots using requestAnimationFrame; heading interpolation uses shortest-arc (360/0 boundary); SWR polling paused during playback; throttled setCurrentTime to ~12-15fps; direct Mapbox source updates bypass React state at 60fps
15. **Internal API Security:** `/api/internal/history-snapshot` requires `INTERNAL_CRON_SECRET` header (timing-safe comparison); POST-only (GET removed for CSRF prevention); readsb data validated before DB insert (hex format, lat/lon ranges)
16. **Playback Performance:** Direct Mapbox `getSource().setData()` calls during playback avoid React re-renders; O(n) Set-based interpolation lookup replaces O(n^2) array scan; pulse animations gated on emergency count; trail points capped at 2000 during playback; version counter ref replaces playbackTime in memo deps
17. **Data Validation:** History queries enforce `from < to`, max 60-minute range, valid hex codes, and `take: 100000` safety limit; feeder heartbeat validates hex format and coordinate ranges before insert
18. **Feeder Scoring:** Composite 0-100 score calculated hourly using formula: `(40*uptime + 30*messageRate + 20*positionRate + 10*aircraftCount)` normalized to percentiles; range calculated via haversine distance from aircraft positions in heartbeat payload
19. **Error Tracking:** Sentry integration for client, server, and edge runtime with custom error contexts and filtering
20. **Worker Database Scaling:** Optional `WORKER_DATABASE_URL` for dedicated connection pool in background worker processes (stats, history, cleanup, segmenter)
21. **Health Checks:** `/api/health` endpoint (no auth) for Kubernetes/Dokploy readiness verification

---

## 8. Environment Variables

```bash
# Required
DATABASE_URL=postgresql://user:pass@host:5432/db
BETTER_AUTH_SECRET=<32+ char secret>
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
READSB_JSON_URL=http://localhost:8080/data/aircraft.json
NEXT_PUBLIC_MAPBOX_TOKEN=<mapbox token>

# Rate Limiting
UPSTASH_REDIS_REST_URL=<upstash redis url>
UPSTASH_REDIS_REST_TOKEN=<upstash redis token>

# Error Tracking
NEXT_PUBLIC_SENTRY_DSN=<sentry dsn>
SENTRY_AUTH_TOKEN=<sentry auth token>
SENTRY_ORG=<sentry org slug>
SENTRY_PROJECT=<sentry project slug>

# Optional
BEAST_PORT=30004
INTERNAL_CRON_SECRET=<secret for history recorder>
HISTORY_RETENTION_HOURS=24
WORKER_DATABASE_URL=<separate connection pool for workers>
```

---

## 9. Development Commands

```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run lint             # ESLint
npm run test             # Run tests in watch mode
npm run test:run         # Run tests once
npm run db:push          # Sync Prisma schema to DB
npm run db:migrate       # Create migration
npm run db:studio        # Prisma Studio GUI
npm run workers          # Run all background workers (stats, history, cleanup, segmenter)
npx tsx scripts/stats-worker.ts         # Collect feeder stats hourly
npx tsx scripts/history-recorder.ts     # Aircraft position recorder (10s interval)
npx tsx scripts/history-cleanup.ts      # Clean old position data (hourly)
npx tsx scripts/flight-segmenter.ts     # Detect flights from positions (5min interval)
curl http://localhost:3000/api/health  # Health check endpoint
```

---

## 10. Remaining Work

See [ROADMAP.md](./ROADMAP.md) for the full development plan (Phases 9-12).

**Phase 7 Complete:**
- [x] Feeder scoring system (0-100 composite score from uptime, message rate, position rate, aircraft count)
- [x] Range tracking (max/avg range per feeder using haversine formula)
- [x] Uptime visualization (7-day chart on feeder detail page)
- [x] Enhanced leaderboard (score column, search, sort by score/range)

**Phase 7.5 Complete:**
- [x] Share button on feeder detail page (copies URL to clipboard)
- [x] 7-Day Summary table with daily aggregated stats
- [x] Nearby Airports section (5 closest airports with distances)
- [x] Monthly Summary card with this month's aggregated statistics
- [x] Worker Dockerfile and PM2 ecosystem config for production deployment
- [x] Development workers script for multi-worker testing

**Phase 8 Complete:**
- [x] Redis-backed rate limiting via Upstash with in-memory fallback
- [x] Sentry error tracking for client, server, and edge runtime
- [x] Vitest test coverage with GitHub Actions CI
- [x] Landing page redesign with animated stats and dark aviation theme
- [x] Component refactoring (10 feeder, 7 map components)
- [x] Enrollment token flow for secure Pi registration
- [x] Connection pooling with worker database URL support
- [x] Health check endpoint for deployment monitoring

**Immediate Priorities (Phase 9):**
- [ ] Regional leaderboard rankings (group feeders by region)
- [ ] Advanced filtering on leaderboard (altitude range, squawk filtering)
- [ ] Feeder comparison view (side-by-side stats for selected feeders)

**Technical Debt:**
- [ ] Gzip compression on API responses
- [ ] IndexedDB caching for static data (airports, aircraft types)

**Integration:**
- [ ] HangarTrak integration (update HangarTrak to consume this API)
- [ ] Production deployment to Dokploy
- [ ] Stripe integration for PRO tier

---

*Last Updated: January 28, 2026 (Phase 8 Complete - Infrastructure, Testing, Security)*
