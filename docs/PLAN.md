# HangarTrak Radar - Implementation Plan

## Overview
HangarTrak Radar is the community-powered ADS-B feeder network that powers aircraft tracking for HangarTrak. It receives feeds from Raspberry Pis running readsb, displays live aircraft using tar1090, and provides a Next.js dashboard with user accounts, feeder management, and a public API.

**Goal:** Replace adsb.lol dependency in HangarTrak with our own community feeder network.

**Stack**: tar1090 + Next.js 16 + readsb | PostgreSQL | Better Auth | Dokploy on Hostinger VPS

## Architecture

### Integration with HangarTrak

**Current HangarTrak Data Flow (before):**
```
Local dump1090 (single Pi) → HangarTrak
       ↓ (fallback for aircraft outside range)
adsb.lol API → HangarTrak
```

**Future Data Flow (with HangarTrak Radar):**
```
Community feeders (many Pis) → HangarTrak Radar → HangarTrak
                                    ↓
                              Public API (for others)
```

### Dokploy Applications (3 separate services)

```
┌─────────────────┐     ┌─────────────────────────────────────────────────────────────────┐
│  Raspberry Pi   │     │                     Dokploy (Separate Apps)                     │
│  (readsb)       │     │                                                                 │
│                 │     │  ┌─────────────────────────────────────────────────────────┐    │
│  Beast output   │────▶│  │  hangartrak-radar (readsb + tar1090)                   │    │
└─────────────────┘     │  │  - TCP :30004 (Beast input from feeders)               │    │
                        │  │  - HTTP :8080 (tar1090 map UI)                         │    │
                        │  └─────────────────────────────────────────────────────────┘    │
                        │                           │                                     │
                        │                           ▼ (reads JSON)                        │
                        │  ┌─────────────────────────────────────────────────────────┐    │
                        │  │  hangartrak-radar-web (Next.js Dashboard)              │    │
                        │  │  - User accounts & authentication                       │    │
                        │  │  - Feeder registration & management                     │    │
                        │  │  - Leaderboards & statistics                            │    │
                        │  │  - API for feeders & HangarTrak                         │    │
                        │  └─────────────────────────────────────────────────────────┘    │
                        │                           │                                     │
                        │                           ▼                                     │
                        │  ┌─────────────────────────────────────────────────────────┐    │
                        │  │  hangartrak-radar-db (PostgreSQL)                       │    │
                        │  └─────────────────────────────────────────────────────────┘    │
                        └─────────────────────────────────────────────────────────────────┘

Domains (via Traefik):
  radar.hangartrak.com  → hangartrak-radar-web:3000 (Next.js dashboard)
  map.hangartrak.com    → hangartrak-radar:8080 (tar1090 live map)

Ports (direct, not proxied):
  :30004                → hangartrak-radar (Beast TCP for feeders)
```

### Feeder Self-Reporting

Since readsb aggregates all feeds together without per-feeder attribution, each Pi runs a stats reporter service that POSTs to `/api/v1/feeders/:uuid/heartbeat` every 30 seconds with:
- Aircraft count with positions
- Messages received (delta since last report)
- Positions received (delta since last report)

This pattern matches what ADSBExchange and other aggregators use.

## Technology Stack

| Component | Technology |
|-----------|------------|
| Live Map | tar1090 (industry standard, used by adsb.fi, adsb.lol) |
| Dashboard | Next.js 16 (App Router) + TypeScript |
| Auth | Better Auth |
| Database | PostgreSQL (Dokploy managed) |
| Beast Server | readsb (aggregator mode via sdr-enthusiasts Docker image) |
| Styling | Tailwind CSS + shadcn/ui |
| Deployment | Dokploy (separate apps) |
| VPS | Hostinger |

## Implementation Status

### Phase 1: Infrastructure ✅
- [x] Aggregator Docker (readsb + tar1090 using sdr-enthusiasts image)
- [x] Next.js project setup
- [x] Prisma schema & database
- [x] Test aggregator with Pi feeder

### Phase 2: Dashboard Foundation ✅
- [x] Better Auth authentication (login/register)
- [x] User dashboard
- [x] Basic layout with shadcn/ui

### Phase 3: Feeder Management ✅
- [x] Feeder registration flow (generates UUID)
- [x] User dashboard showing their feeders
- [x] Personalized install script endpoint (`/api/install/[uuid]`)
- [x] Feeder self-reporting (heartbeat API)
- [x] Feeder status tracking

### Phase 4: Statistics & API ✅
- [x] Background stats worker
- [x] Public API endpoints (`/api/v1/aircraft`, `/api/v1/stats`)
- [x] API key generation in user dashboard

### Phase 5: Branding & Integration ✅
- [x] Rebrand to HangarTrak Radar
- [x] Update all branding (UI, scripts, Docker, docs)
- [x] Document integration points with HangarTrak

### Phase 6: Custom Mapbox Live Map 🔄

Replace tar1090's default Leaflet map with a custom Mapbox-powered map for a polished, branded experience.

#### 6a: Core Map (In Progress)
- [x] Mapbox dark style base map
- [x] Aircraft markers with heading rotation
- [x] Altitude color coding (green → purple gradient)
- [x] Click to select aircraft
- [x] Aircraft info panel (callsign, altitude, speed, squawk, ICAO)
- [x] Auto-refresh from readsb JSON (1s interval)
- [x] Aircraft count overlay
- [x] Altitude legend

#### 6b: Enhanced Visualization ✅
- [x] Flight trails/history (full path, altitude-colored)
- [x] Emergency squawk highlighting (7500/7600/7700 with pulse rings)
- [ ] MLAT indicator (different icon style or badge for MLAT positions)
- [x] Aircraft type icons (jet, prop, helicopter, glider based on ICAO category)
- [x] Range rings (concentric circles from receiver/user location)
- [x] Distance/bearing from center

#### 6c: Aircraft List Sidebar ✅
- [x] Collapsible sidebar/panel showing all aircraft in a table
- [x] Columns: callsign, altitude, speed, squawk
- [x] Click row to select aircraft on map (and vice versa)
- [x] Sort by column (click column header)
- [x] Highlight selected aircraft row
- [x] Show aircraft count in header
- [x] Emergency aircraft pinned to top with red highlight
- [x] Responsive: full sidebar on desktop, bottom drawer on mobile

#### 6d: User Experience ✅
- [x] URL sharing (selected aircraft hex in URL params)
- [x] Dark/light mode toggle
- [x] Metric/imperial toggle (ft↔m, kts↔km/h)
- [ ] Keyboard shortcuts (zoom, pan, deselect)
- [x] Mobile responsive (bottom sheet info panel)

#### 6e: Advanced Features ✅
- [x] Historical playback (scrub through past positions)
- [x] Receiver coverage visualization (heatmap of received positions)
- [x] Search by callsign/hex/registration (Flight Search feature)
- [x] All Aircraft Trails layer (shows 2-min trails for all visible aircraft)
- [ ] Aircraft filtering (by altitude, type, squawk)

#### 6f: Map Enhancements ✅
- [x] Airport markers layer with ICAO codes
- [x] Map style selector (Streets/Satellite/Dark/Light)

### Phase 7: Polish & Launch
- [ ] Leaderboard page (top feeders by stats)
- [ ] Historical charts (feeder stats over time)
- [ ] Rate limiting middleware
- [ ] API documentation page
- [ ] Production deployment to Dokploy

### Phase 8: HangarTrak Integration
- [ ] Add HangarTrak Radar as data source in HangarTrak
- [ ] Update fallback chain: Local → HangarTrak Radar → adsb.lol
- [ ] Test end-to-end aircraft tracking

## Database Schema

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  apiKey    String?  @unique
  apiTier   ApiTier  @default(FREE)
  feeders   Feeder[]
  createdAt DateTime @default(now())
}

enum ApiTier {
  FREE        // 100 req/min, basic endpoints
  FEEDER      // 1000 req/min, auto-granted to active feeders
  PRO         // 10000 req/min, paid (future)
}

model Feeder {
  id             String   @id @default(cuid())
  uuid           String   @unique
  name           String
  latitude       Float?
  longitude      Float?
  userId         String
  user           User     @relation(fields: [userId], references: [id])
  messagesTotal  BigInt   @default(0)
  positionsTotal BigInt   @default(0)
  aircraftSeen   Int      @default(0)
  lastSeen       DateTime?
  isOnline       Boolean  @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  stats          FeederStats[]
}

model FeederStats {
  id        String   @id @default(cuid())
  feederId  String
  feeder    Feeder   @relation(fields: [feederId], references: [id])
  timestamp DateTime @default(now())
  messages  Int
  positions Int
  aircraft  Int
}
```

## API Endpoints

### Public API (rate limited)
```
GET /api/v1/aircraft              - All current aircraft
GET /api/v1/aircraft/:hex         - Single aircraft by ICAO hex
GET /api/v1/stats                 - Network statistics
GET /api/v1/feeders               - Feeder leaderboard
```

### Feeder API (authenticated by UUID)
```
POST /api/v1/feeders/:uuid/heartbeat - Report feeder stats
```

### User API (authenticated)
```
GET  /api/feeders                 - List user's feeders
POST /api/feeders                 - Register new feeder
GET  /api/feeders/:id             - Get feeder details
DELETE /api/feeders/:id           - Delete feeder
GET  /api/user/api-key            - Get/regenerate API key
```

## Pi Feeder Setup

When a user registers a feeder, they get a personalized install URL:
```bash
curl -sSL https://radar.hangartrak.com/api/install/YOUR_UUID | sudo bash
```

The script:
1. Creates `/usr/local/share/hangartrak-radar/uuid` with feeder UUID
2. Configures readsb net-connector to send Beast data to the aggregator
3. Installs `hangartrak-radar-stats` systemd service for self-reporting
4. Restarts readsb to apply changes

## Environment Variables

```bash
# Database
DATABASE_URL="postgresql://..."

# Better Auth
BETTER_AUTH_SECRET="..."  # openssl rand -base64 32
BETTER_AUTH_URL="https://radar.hangartrak.com"

# Public URLs
NEXT_PUBLIC_APP_URL="https://radar.hangartrak.com"
NEXT_PUBLIC_MAP_URL="https://map.hangartrak.com"

# readsb JSON (internal Docker network)
READSB_JSON_URL="http://hangartrak-radar:8080/data/aircraft.json"
```

## HangarTrak Integration

When integrating with HangarTrak, update these files:

1. **lib/adsb/data-sources.ts** - Add HangarTrak Radar as a data source
2. **Environment variables** - Add `HANGARTRAK_RADAR_URL`
3. **Fallback chain** - Local dump1090 → HangarTrak Radar → adsb.lol (last resort)

### API Endpoints for HangarTrak
```
GET /api/v1/aircraft              - All current aircraft (same format as adsb.lol)
GET /api/v1/aircraft/:hex         - Single aircraft by ICAO hex
GET /api/v1/stats                 - Network statistics
```

---
**Last Updated:** January 25, 2026
