# HangarTrak Radar - Claude Context File

## Project Overview
HangarTrak Radar is the community-powered ADS-B feeder network that powers aircraft tracking for [HangarTrak](https://hangartrak.com). It receives ADS-B data feeds from Raspberry Pi devices running readsb, displays live aircraft on a tar1090 map, and provides an API that HangarTrak uses instead of relying on third-party services like adsb.lol.

**Status:** Phase 6 - Live map with playback, integrating with HangarTrak
**Goal:** Replace adsb.lol dependency in HangarTrak with our own feeder network

## Integration with HangarTrak

### Current HangarTrak Data Flow (before)
```
Local dump1090 (single Pi) → HangarTrak
       ↓ (fallback for aircraft outside range)
adsb.lol API → HangarTrak
```

### Future Data Flow (with HangarTrak Radar)
```
Community feeders (many Pis) → HangarTrak Radar → HangarTrak
                                    ↓
                              Public API (for others)
```

### Domain Structure (Production)
- `hangartrak.com` - Main HangarTrak app (aircraft tracking, flight logs)
- `radar.hangartrak.com` - Feeder registration & dashboard (this repo)
- `map.hangartrak.com` - tar1090 live map (Docker aggregator)
- `api.hangartrak.com/v1/` - Public aircraft API

## Architecture

### Dokploy Applications (3 separate services)
1. **hangartrak-radar** - readsb + tar1090 (Docker)
   - TCP :30004 - Beast input from feeders
   - HTTP :8080 - tar1090 map UI
2. **hangartrak-radar-web** - Next.js dashboard (this repo)
   - User accounts, feeder management, API
3. **hangartrak-radar-db** - PostgreSQL (Dokploy managed)

### Data Flow
```
Pi (readsb) --Beast--> hangartrak-radar:30004 --> JSON --> tar1090:8080
                                                       \--> Next.js API
                                                       \--> HangarTrak (replaces adsb.lol)
```

### Feeder Self-Reporting
Each Pi runs a stats reporter service that POSTs to `/api/v1/feeders/:uuid/heartbeat` every 30 seconds with:
- Aircraft count with positions
- Messages received (delta)
- Positions received (delta)
- Authorization: Bearer token (heartbeatToken generated at feeder creation, stored on Pi)

This allows accurate per-feeder stats even though readsb aggregates all feeds together.

## Technology Stack
- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Next.js API Routes, Prisma ORM, PostgreSQL, Better Auth
- **Aggregator:** readsb (network-only mode), tar1090
- **Infrastructure:** Dokploy on Hostinger VPS

## Coding Standards

All React and Next.js code should follow the **Vercel React Best Practices** skill (`/vercel-react-best-practices`). Key priorities:

1. **Eliminate waterfalls** - Use `Promise.all()` for independent async ops, defer awaits, use Suspense boundaries
2. **Optimize bundle size** - Import directly (no barrel files), use `next/dynamic` for heavy components, defer third-party scripts
3. **Server-side performance** - Use `React.cache()` for dedup, minimize client serialization, parallelize fetches
4. **Client-side data fetching** - Use SWR for dedup and caching
5. **Minimize re-renders** - Use functional setState, derived state, `startTransition` for non-urgent updates

All authentication code should follow the **Better Auth Best Practices** skill (`/better-auth-best-practices`). Key points:

- Use `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` env vars (don't hardcode in config)
- Import plugins from dedicated paths (e.g., `better-auth/plugins/two-factor`, not `better-auth/plugins`)
- Re-run `npx @better-auth/cli@latest generate` after adding/changing plugins
- Use ORM model names in config, not underlying table names
- Reference [better-auth.com/docs](https://better-auth.com/docs) for latest API

UI components should comply with the **Web Interface Guidelines** skill (`/web-design-guidelines`). Run this skill against UI files to check for accessibility, semantic HTML, interaction patterns, and design best practices.

## Development Workflow

All work happens on `develop` branch (or feature branches off it).

### Pipeline
1. **Branch** — Create feature branch from `develop` (or work directly on `develop`)
2. **Implement** — Use custom agents for domain-specific work
3. **Validate** — Run `npm run build && npm run lint` (must pass)
4. **Docs** — Update CHANGELOG.md with changes
5. **Commit** — Commit to `develop`, PR to `main` when ready for production

### Custom Agents (`.claude/agents/`)

Specialized instruction sets for different domains. Invoke by asking Claude to use them:

**Domain Agents:**
- `api-developer` — API routes, database queries, backend logic
- `map-developer` — Mapbox GL, aircraft rendering, map features
- `ui-designer` — Pages, layouts, components, Tailwind styling
- `auth-developer` — Better Auth, sessions, permissions
- `db-migrator` — Prisma schema changes, migrations

**Supporting Agents:**
- `code-reviewer` — Review code for perf, a11y, security issues
- `test-runner` — Run build/lint/type checks
- `docs-updater` — Update CHANGELOG, SPEC, CLAUDE.md
- `docker-ops` — Aggregator container management
- `api-tester` — curl-based endpoint verification
- `dependency-auditor` — Check for outdated/vulnerable packages
- `git-workflow` — Branch management and PR preparation

**How to invoke:**
```
"Use the api-developer agent to implement the search endpoint"
"Have the code-reviewer agent check my changes"
"Use the map-developer agent to add range rings"
```

Claude reads the agent's instructions from `.claude/agents/[name].md` and follows that specialized context.

### Background Tasks
For long-running work, Claude can spawn background workers using the Task tool with `general-purpose` subagent type. These run independently and report back when complete. Note: Background tasks don't have access to custom agents.

## Quick Reference

### Essential Environment Variables
```bash
DATABASE_URL="postgresql://..."
BETTER_AUTH_SECRET="..."  # Generate: openssl rand -base64 32
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_MAP_URL="http://localhost:8080"
READSB_JSON_URL="http://localhost:8080/data/aircraft.json"
NEXT_PUBLIC_MAPBOX_TOKEN="..."  # Mapbox GL JS token
INTERNAL_CRON_SECRET="..."  # Secret for history recorder auth
HISTORY_RETENTION_HOURS=24  # How long to keep position data (default: 24)
```

### Common Commands
```bash
# Development
npm run dev              # Start dev server
npm run build            # Production build
npm run lint             # Run ESLint

# Database
npx prisma migrate dev --name <name>
npx prisma generate
npx prisma studio

# Docker (aggregator)
docker build -t hangartrak-radar ./docker/aggregator
docker run --name hangartrak-radar -p 30004:30004 -p 8080:80 hangartrak-radar

# History recorder (saves aircraft positions every 10s)
npx tsx scripts/history-recorder.ts

# History cleanup (remove old position data)
npx tsx scripts/history-cleanup.ts
```

### Project Structure
```
adsb/
├── app/                     # Next.js App Router
│   ├── (auth)/              # Auth pages (login, register)
│   ├── (dashboard)/         # Dashboard pages
│   ├── (public)/            # Public pages (leaderboard, docs)
│   └── api/                 # API routes
│       ├── v1/              # Public API (aircraft, stats, feeders, history)
│       ├── internal/        # Internal APIs (history-snapshot)
│       ├── map/             # Map APIs (aircraft, history)
│       └── install/[uuid]/  # Personalized install scripts
├── components/              # React components
│   └── ui/                  # shadcn/ui
├── lib/                     # Utilities
│   ├── prisma.ts            # Database client
│   ├── auth.ts              # Better Auth config (exports Session/User types)
│   ├── auth-client.ts       # Better Auth React client
│   ├── auth-server.ts       # Server session helpers (React.cache wrapped)
│   ├── readsb.ts            # Aircraft data fetching (React.cache wrapped)
│   ├── fetcher.ts           # Shared SWR fetcher with error handling
│   ├── format.ts            # Shared formatNumber utility
│   └── api/                 # API middleware, rate limiting
├── prisma/                  # Database schema
├── docker/
│   └── aggregator/          # readsb + tar1090 Docker
├── scripts/
│   ├── feeder-stats.sh      # Pi stats reporter template
│   ├── stats-worker.ts      # Background stats collection
│   ├── history-recorder.ts  # Saves aircraft positions every 10s
│   ├── history-cleanup.ts   # Removes old position data (retention)
│   └── flight-segmenter.ts  # Detects flights from positions, creates Flight records
├── docs/
│   └── PLAN.md              # Original implementation plan
├── Dockerfile               # Next.js production build
└── CLAUDE.md                # This file
```

### Database Models
- **User** - Account with hashed API key (`apiKeyHash`), display prefix (`apiKeyPrefix`), and tier
- **Feeder** - Pi device sending data (UUID, `heartbeatToken`, stats, location)
- **FeederStats** - Historical statistics (hourly snapshots)
- **AircraftPosition** - Historical aircraft position snapshots (hex, lat, lon, altitude, heading, speed, squawk, flight, timestamp)
- **Flight** - Archived flight records with embedded positions JSON (hex, callsign, start/end times, stats, downsampled positions)
- **Session/Account/Verification** - Better Auth tables

### API Tiers
| Tier | Rate Limit | Access |
|------|------------|--------|
| FREE | 100 req/min | Basic endpoints |
| FEEDER | 1000 req/min | Full API (active feeders) |
| PRO | 10000 req/min | Full API + priority (future) |

### Key Patterns
- API key via `x-api-key` header (hashed with SHA-256 for storage, looked up by hash)
- Rate limiting in `lib/api/middleware.ts` (in-memory, per API key or IP)
- Heartbeat auth via `Authorization: Bearer <heartbeatToken>` (timing-safe comparison)
- Internal API auth via `INTERNAL_CRON_SECRET` header (timing-safe comparison)
- Aircraft data from tar1090 JSON endpoint
- Feeders connect via readsb `--net-connector`
- Feeders self-report stats via heartbeat API
- Input validation: feeder names restricted to `[a-zA-Z0-9 _\-\.]`, max 64 chars
- Historical playback: positions stored every ~10s, interpolated client-side at 60fps via requestAnimationFrame
- Aircraft type icons: canvas-rendered SDF icons mapped from ICAO emitter category codes via Mapbox expressions

## Implementation Status

### Completed
- [x] Aggregator Docker (readsb + tar1090)
- [x] Next.js project setup
- [x] Prisma schema & database
- [x] Better Auth authentication
- [x] Feeder registration & management
- [x] Personalized install scripts
- [x] Feeder self-reporting (heartbeat API)
- [x] Public API endpoints (/api/v1/aircraft, /api/v1/stats)
- [x] API key generation
- [x] Landing page
- [x] HangarTrak branding

### In Progress
- [x] Custom Mapbox live map (Phase 6a core complete)
- [x] Flight trails/history for selected aircraft
- [x] Emergency squawk highlighting (7500/7600/7700)
- [ ] MLAT indicator
- [x] Aircraft type icons (jet, prop, helicopter)
- [x] Range rings and distance/bearing (with user location & feeder location privacy)
- [x] Aircraft list sidebar (sortable table, click to select)
- [ ] URL sharing, dark/light mode, metric/imperial toggles
- [x] Historical playback (timeline slider, play/pause, speed control, interpolation)
- [x] Flight search & replay (search by callsign/hex, flight history table, replay button)
- [ ] Receiver coverage visualization

### Map Layer Roadmap
Future map layers to implement (toggleable via Layers panel):

**Flight Tracking**
- [ ] Flight trails for all aircraft (not just selected)
- [ ] Altitude/speed-based coloring toggle
- [ ] Always-on callsign labels
- [ ] MLAT vs ADS-B indicators

**Coverage & Analysis**
- [ ] Receiver coverage heatmap
- [ ] Altitude band shading
- [ ] Airport markers with ICAO codes
- [ ] Airspace boundaries (Class B/C/D)

**Weather & Environment**
- [ ] Weather radar overlay
- [ ] Wind barbs at altitude
- [ ] Day/night terminator line

**UI & Styles**
- [ ] Map style toggle (streets/satellite/dark)
- [ ] Terrain elevation shading
- [ ] Lat/lon grid overlay

### Remaining
- [ ] Historical charts (feeder stats over time)
- [ ] API documentation page (content)
- [ ] HangarTrak integration (update HangarTrak to use this API)
- [ ] Production deployment to Dokploy

## HangarTrak Integration Points

When integrating with HangarTrak, update these in the HangarTrak codebase:

1. **lib/adsb/data-sources.ts** - Add HangarTrak Radar as a data source
2. **Environment variables** - Add `HANGARTRAK_RADAR_URL`
3. **Fallback chain** - Local dump1090 → HangarTrak Radar → adsb.lol (last resort)

### API Endpoints for HangarTrak
```
GET /api/v1/aircraft              - All current aircraft
GET /api/v1/aircraft/:hex         - Single aircraft by ICAO hex
GET /api/v1/stats                 - Network statistics
GET /api/v1/history?from=&to=     - Historical positions (max 60 min range)
```

## Documentation Maintenance

**IMPORTANT:** After every feature addition, bug fix, or significant change, update:

1. **`CHANGELOG.md`** - Add entry under `[Unreleased]` with the appropriate category (Added, Changed, Fixed, Removed)
2. **`SPEC.md`** - Update relevant sections if the change affects architecture, APIs, pages, or schema

When cutting a release, move `[Unreleased]` entries to a new versioned section.

---
**Last Updated:** January 2026
