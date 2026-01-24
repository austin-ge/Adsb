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

### Backend
- Next.js API Routes
- Prisma ORM 6.0
- PostgreSQL
- Better Auth 1.0
- Zod (validation)

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
- isOnline, lastSeen
- messagesTotal, positionsTotal, aircraftSeen
- userId (foreign key)
- Relations: stats[]

**FeederStats**
- id, feederId (foreign key)
- messages, positions, aircraftCount
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
| `/leaderboard` | Top feeders ranked by contribution (period/sort synced to URL params) |
| `/docs/api` | API documentation |

### Dashboard Pages (authenticated)
| Route | Description |
|-------|------------|
| `/dashboard` | Overview with stats and feeder list |
| `/feeders` | Manage feeders |
| `/feeders/[id]` | Individual feeder detail & stats |
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
| POST | `/feeders/[uuid]/heartbeat` | Bearer token | Feeder stats reporting (rate limited: 10/min) |
| GET | `/feeders/[uuid]/heartbeat` | None | Feeder status check |

**Aircraft Filters:** bounds (N/S/E/W), altitude range, callsign
**History Params:** from/to (ISO 8601, max 60min range), hex (optional ICAO filter)

### Internal APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/feeders` | User's feeders (authenticated) |
| POST | `/api/feeders` | Create new feeder |
| GET/DELETE | `/api/feeders/[id]` | Manage feeder |
| POST | `/api/user/api-key` | Generate API key |
| GET | `/api/install/[uuid]` | Personalized Pi install script |
| GET | `/api/leaderboard` | Leaderboard data |
| GET | `/api/stats` | Network stats |
| GET | `/api/map/aircraft` | Aircraft for map visualization |
| GET | `/api/map/history` | Historical positions for map playback (params: from, to) |
| POST | `/api/internal/history-snapshot` | Record aircraft positions (auth: INTERNAL_CRON_SECRET, POST-only for CSRF prevention) |

---

## 7. Key Implementation Patterns

1. **Automatic Tier Upgrade:** First heartbeat from a feeder upgrades owner from FREE to FEEDER tier
2. **Location Privacy:** Feeder coordinates only exposed to FEEDER+ tier API consumers
3. **Rate Limiting:** In-memory rate limiter keyed by API key or IP, configurable per tier. Better Auth endpoints also rate-limited (10 req/60s).
4. **Install Scripts:** Personalized bash scripts generated per-feeder with embedded UUID
5. **Aircraft Data Pipeline:** readsb aggregates feeds → tar1090 JSON → Next.js API → clients
6. **Emergency Squawk Detection:** Aircraft with squawk 7500 (hijack), 7600 (radio failure), or 7700 (emergency) get color override, enlarged icons, pulsing rings, and info panel banners
7. **Server-Side Deduplication:** `React.cache()` wraps `getServerSession` and `fetchAircraftData` to prevent redundant calls within a single request
8. **Parallel Database Queries:** Stats and heartbeat routes use `Promise.all()` for independent queries
9. **Bundle Optimization:** Heavy libraries (mapbox-gl, recharts) loaded via `next/dynamic` with SSR disabled; `optimizePackageImports` eliminates barrel file costs
10. **Map Performance:** SWR for data polling, `requestAnimationFrame` for animations via Mapbox API (no React state churn), stable callbacks via refs, `content-visibility: auto` on list items, polling-based custom icon loading (avoids `onLoad` timing issues with dynamic imports), canvas-rendered SDF aircraft type icons (jet/turboprop/helicopter/light/generic) with per-feature icon selection via Mapbox expressions
11. **Accessibility:** WCAG-compliant with aria-hidden on decorative icons, aria-labels on controls, skip-nav links, proper focus indicators, reduced-motion support, semantic form attributes, map container `role="application"`, stats `aria-live="polite"`, playback controls `role="group"` with `aria-valuetext`, and focus-visible styles on interactive elements
12. **Shared Utilities:** `lib/fetcher.ts` (SWR fetcher with error handling) and `lib/format.ts` (number formatting) prevent code duplication
13. **Historical Playback:** Position snapshots stored every ~10s by external recorder script; map UI loads time ranges and interpolates aircraft positions between snapshots using requestAnimationFrame; heading interpolation uses shortest-arc (360/0 boundary); SWR polling paused during playback; throttled setCurrentTime to ~12-15fps; direct Mapbox source updates bypass React state at 60fps
14. **Internal API Security:** `/api/internal/history-snapshot` requires `INTERNAL_CRON_SECRET` header (timing-safe comparison); POST-only (GET removed for CSRF prevention); readsb data validated before DB insert (hex format, lat/lon ranges)
15. **Playback Performance:** Direct Mapbox `getSource().setData()` calls during playback avoid React re-renders; O(n) Set-based interpolation lookup replaces O(n^2) array scan; pulse animations gated on emergency count; trail points capped at 2000 during playback; version counter ref replaces playbackTime in memo deps
16. **Data Validation:** History queries enforce `from < to`, max 60-minute range, valid hex codes, and `take: 100000` safety limit; feeder heartbeat validates hex format and coordinate ranges before insert

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

# Optional
BEAST_PORT=30004
INTERNAL_CRON_SECRET=<secret for history recorder>
HISTORY_RETENTION_HOURS=24
```

---

## 9. Development Commands

```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run lint             # ESLint
npm run db:push          # Sync Prisma schema to DB
npm run db:migrate       # Create migration
npm run db:studio        # Prisma Studio GUI
npm run worker           # Background stats worker
npx tsx scripts/history-recorder.ts  # Aircraft position recorder (10s interval)
npx tsx scripts/history-cleanup.ts   # Clean old position data
```

---

## 10. Remaining Work

- [ ] Historical charts (feeder stats over time)
- [ ] Rate limiting - Redis-backed for production
- [ ] API documentation page (content)
- [ ] HangarTrak integration (update HangarTrak to consume this API)
- [ ] Production deployment to Dokploy
- [ ] Stripe integration for PRO tier

---

*Last Updated: January 24, 2026*
