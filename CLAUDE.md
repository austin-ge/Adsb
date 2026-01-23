# HangarTrak Radar - Claude Context File

## Project Overview
HangarTrak Radar is the community-powered ADS-B feeder network that powers aircraft tracking for [HangarTrak](https://hangartrak.com). It receives ADS-B data feeds from Raspberry Pi devices running readsb, displays live aircraft on a tar1090 map, and provides an API that HangarTrak uses instead of relying on third-party services like adsb.lol.

**Status:** Phase 5 - Core features complete, integrating with HangarTrak
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

## Quick Reference

### Essential Environment Variables
```bash
DATABASE_URL="postgresql://..."
BETTER_AUTH_SECRET="..."  # Generate: openssl rand -base64 32
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_MAP_URL="http://localhost:8080"
READSB_JSON_URL="http://localhost:8080/data/aircraft.json"
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
```

### Project Structure
```
adsb/
├── app/                     # Next.js App Router
│   ├── (auth)/              # Auth pages (login, register)
│   ├── (dashboard)/         # Dashboard pages
│   ├── (public)/            # Public pages (leaderboard, docs)
│   └── api/                 # API routes
│       ├── v1/              # Public API (aircraft, stats, feeders)
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
│   └── stats-worker.ts      # Background stats collection
├── docs/
│   └── PLAN.md              # Original implementation plan
├── Dockerfile               # Next.js production build
└── CLAUDE.md                # This file
```

### Database Models
- **User** - Account with hashed API key (`apiKeyHash`), display prefix (`apiKeyPrefix`), and tier
- **Feeder** - Pi device sending data (UUID, `heartbeatToken`, stats, location)
- **FeederStats** - Historical statistics (hourly snapshots)
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
- Aircraft data from tar1090 JSON endpoint
- Feeders connect via readsb `--net-connector`
- Feeders self-report stats via heartbeat API
- Input validation: feeder names restricted to `[a-zA-Z0-9 _\-\.]`, max 64 chars

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
- [ ] Aircraft type icons (jet, prop, helicopter)
- [ ] Range rings and distance/bearing
- [x] Aircraft list sidebar (sortable table, click to select)
- [ ] URL sharing, dark/light mode, metric/imperial toggles
- [ ] Historical playback and receiver coverage visualization

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
```

## Documentation Maintenance

**IMPORTANT:** After every feature addition, bug fix, or significant change, update:

1. **`CHANGELOG.md`** - Add entry under `[Unreleased]` with the appropriate category (Added, Changed, Fixed, Removed)
2. **`SPEC.md`** - Update relevant sections if the change affects architecture, APIs, pages, or schema

When cutting a release, move `[Unreleased]` entries to a new versioned section.

---
**Last Updated:** January 2026
