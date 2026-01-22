# HangarTrak Radar - Project Specification

## 1. Executive Summary

HangarTrak Radar is a community-powered ADS-B feeder network that aggregates aircraft position data from distributed Raspberry Pi receivers. It serves as the primary aircraft data source for [HangarTrak](https://hangartrak.com), replacing the previous dependency on third-party services like adsb.lol.

The system provides:
- A central aggregation point for ADS-B data from community feeders
- A live aircraft map powered by tar1090
- A user dashboard for feeder registration and management
- A public REST API for aircraft data consumption
- Self-reporting feeder statistics and leaderboards

---

## 2. Problem Statement

HangarTrak relies on real-time aircraft position data. Previously, this came from a single local dump1090 receiver (limited range) with adsb.lol as a fallback for aircraft outside reception range. This architecture has several drawbacks:

1. **Single point of failure** - One receiver means limited geographic coverage
2. **Third-party dependency** - adsb.lol could change terms, rate limit, or go offline
3. **No control over data quality** - Cannot guarantee freshness or accuracy
4. **Limited coverage area** - Single receiver covers ~200nm radius

HangarTrak Radar solves these by building a first-party feeder network with community contributors.

---

## 3. System Architecture

### 3.1 High-Level Overview

```
┌─────────────────────┐
│  Community Feeders   │     (Many Raspberry Pis with SDR receivers)
│  (Raspberry Pi +    │
│   RTL-SDR + readsb) │
└────────┬────────────┘
         │ Beast protocol (TCP :30004)
         ▼
┌─────────────────────┐
│  hangartrak-radar   │     Aggregator (readsb + tar1090 Docker)
│  - readsb aggregate │     - Merges all feeder data
│  - tar1090 web UI   │     - Produces JSON aircraft state
│  - TCP :30004 in    │     - Serves live map on :8080
│  - HTTP :8080 out   │
└────────┬────────────┘
         │ JSON (aircraft.json)
         ▼
┌─────────────────────┐
│  hangartrak-radar-  │     Next.js Dashboard & API
│  web                │     - User accounts & auth
│  - Dashboard :3000  │     - Feeder management
│  - REST API         │     - Public aircraft API
│  - Feeder mgmt     │     - Statistics & leaderboards
└────────┬────────────┘
         │ SQL
         ▼
┌─────────────────────┐
│  hangartrak-radar-  │     PostgreSQL Database
│  db                 │     - Users, sessions, feeders
│  - PostgreSQL       │     - Statistics history
└─────────────────────┘
```

### 3.2 Domain Structure

| Domain | Service | Purpose |
|--------|---------|---------|
| `radar.hangartrak.com` | Next.js app | Dashboard, feeder registration, API |
| `map.hangartrak.com` | tar1090 | Live aircraft map |
| `api.hangartrak.com/v1/` | Next.js API | Public REST API |
| `hangartrak.com` | HangarTrak | Main app (consumer of this API) |

### 3.3 Data Flow

```
Feeder Pi ──Beast TCP──▶ readsb aggregator ──JSON──▶ Next.js API ──REST──▶ HangarTrak
                                │                         │
                                ▼                         ▼
                         tar1090 live map          PostgreSQL (stats)
                                │
                                ▼
                    Feeder Pi ──heartbeat POST──▶ Next.js API (stats collection)
```

### 3.4 Deployment Infrastructure

- **Platform:** Dokploy on Hostinger VPS
- **Proxy:** Traefik (managed by Dokploy) for HTTPS and domain routing
- **Services:** 3 separate Dokploy applications
- **Networking:** Internal Docker network between services; TCP :30004 exposed directly for Beast input

---

## 4. Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Frontend | Next.js (App Router) | 16 | Server/client rendering |
| UI | React | 19 | Component framework |
| Styling | Tailwind CSS | 3.4 | Utility-first CSS |
| Components | shadcn/ui + Radix | Latest | Accessible UI primitives |
| Language | TypeScript | 5 | Type safety |
| ORM | Prisma | 6 | Database access & migrations |
| Database | PostgreSQL | 16 | Persistent storage |
| Auth | Better Auth | 1.0 | Sessions, email/password |
| Charts | Recharts | 2.14 | Data visualization |
| Data Fetching | SWR | 2.2 | Client-side caching |
| Validation | Zod | 3.23 | Schema validation |
| Icons | Lucide React | 0.460 | Icon set |
| Aggregator | readsb | Latest | ADS-B message aggregation |
| Map | tar1090 | Latest | Aircraft visualization |
| Container | Docker | Latest | Aggregator packaging |

---

## 5. Database Schema

### 5.1 Entity Relationship

```
user 1──* session
user 1──* account
user 1──* Feeder
Feeder 1──* FeederStats
user 1──0..1 Subscription (future)
```

### 5.2 Models

#### user
Core user account with Better Auth fields plus custom ADS-B extensions.

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key (cuid) |
| email | String | Unique email address |
| emailVerified | Boolean | Email verification status |
| name | String | Display name |
| image | String? | Avatar URL |
| apiKey | String? | Unique API key (`adsb_live_` + 32 hex) |
| apiTier | ApiTier | Rate limit tier (FREE/FEEDER/PRO) |
| createdAt | DateTime | Account creation time |
| updatedAt | DateTime | Last modification |

#### Feeder
Represents a Raspberry Pi sending ADS-B data to the aggregator.

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key (cuid) |
| uuid | String | Unique feeder identifier (for Beast connection) |
| name | String | User-assigned name |
| latitude | Float? | Feeder location (optional) |
| longitude | Float? | Feeder location (optional) |
| userId | String | Owner foreign key |
| messagesTotal | BigInt | Cumulative messages received |
| positionsTotal | BigInt | Cumulative positions received |
| aircraftSeen | Int | Unique aircraft count |
| lastSeen | DateTime? | Last heartbeat timestamp |
| isOnline | Boolean | Currently active (heartbeat within 60s) |
| createdAt | DateTime | Registration time |
| updatedAt | DateTime | Last modification |

#### FeederStats
Hourly snapshots of feeder performance for historical tracking.

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key (cuid) |
| feederId | String | Feeder foreign key |
| timestamp | DateTime | Snapshot time |
| messages | Int | Messages in period |
| positions | Int | Positions in period |
| aircraft | Int | Unique aircraft in period |

#### ApiTier Enum

| Tier | Rate Limit | Access Level | How Obtained |
|------|-----------|--------------|--------------|
| FREE | 100 req/min | Basic endpoints | Default for all users |
| FEEDER | 1000 req/min | Full API access | Auto-granted on first heartbeat |
| PRO | 10000 req/min | Full API + priority | Paid subscription (future) |

---

## 6. API Specification

### 6.1 Public API (v1)

All public endpoints require an API key via the `x-api-key` header. Rate limiting is enforced per-key with tier-based limits.

**Response Headers (all endpoints):**
```
X-RateLimit-Limit: <max requests per window>
X-RateLimit-Remaining: <remaining requests>
X-RateLimit-Reset: <unix timestamp of window reset>
```

#### GET /api/v1/aircraft
Returns all currently tracked aircraft.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| bounds | string | Lat/lng bounding box: `south,west,north,east` |
| min_alt | number | Minimum altitude filter (feet) |
| max_alt | number | Maximum altitude filter (feet) |
| flight | string | Filter by flight/callsign |
| limit | number | Max results (default: all) |

**Response:**
```json
{
  "now": 1706000000.0,
  "aircraft": [
    {
      "hex": "a1b2c3",
      "flight": "UAL123",
      "lat": 39.8283,
      "lon": -98.5795,
      "alt_baro": 35000,
      "alt_geom": 35200,
      "gs": 450,
      "track": 270,
      "squawk": "1200",
      "category": "A3",
      "seen": 0.5,
      "seen_pos": 1.2,
      "messages": 150
    }
  ],
  "total": 1
}
```

#### GET /api/v1/aircraft/:hex
Returns a single aircraft by ICAO hex code.

**Response:** Single aircraft object (same schema as above) or 404.

#### GET /api/v1/stats
Returns network-wide statistics.

**Response:**
```json
{
  "feeders": {
    "total": 25,
    "online": 18
  },
  "messages": {
    "total": 1500000000
  },
  "aircraft": {
    "tracked": 5000,
    "live": 342
  }
}
```

#### GET /api/v1/feeders
Returns public feeder list (paginated).

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| online | boolean | Filter by online status |
| limit | number | Results per page (default: 20) |
| offset | number | Pagination offset |

**Note:** Location data (lat/lng) is only returned for FEEDER tier and above.

### 6.2 Feeder API

#### POST /api/v1/feeders/:uuid/heartbeat
Self-reporting endpoint called by the Pi stats service every 30 seconds.

**Request Body:**
```json
{
  "aircraft_count": 42,
  "messages": 1500,
  "positions": 800
}
```

**Behavior:**
- Updates feeder stats (cumulative totals)
- Sets `isOnline = true` and `lastSeen = now()`
- Auto-upgrades owner to FEEDER tier on first heartbeat
- Returns current feeder stats

### 6.3 User API (Session Authenticated)

#### GET /api/feeders
List authenticated user's feeders.

#### POST /api/feeders
Register a new feeder.

**Request Body:**
```json
{
  "name": "My Rooftop Pi",
  "latitude": 39.8283,
  "longitude": -98.5795
}
```

**Response:** Created feeder object with generated UUID.

#### GET /api/feeders/:id
Get feeder details (must be owned by authenticated user).

#### DELETE /api/feeders/:id
Remove a feeder (must be owned by authenticated user).

#### GET /api/user/api-key
Get current API key (masked for display).

#### POST /api/user/api-key
Generate a new API key (replaces existing).

#### DELETE /api/user/api-key
Revoke current API key.

### 6.4 Installation Endpoint

#### GET /api/install/:uuid
Returns a personalized Bash installation script for a feeder. Designed to be piped to `sudo bash`:

```bash
curl -sSL https://radar.hangartrak.com/api/install/YOUR_UUID | sudo bash
```

The script:
1. Configures readsb `--net-connector` to send Beast data to the aggregator
2. Installs a systemd service (`hangartrak-radar-stats`) for heartbeat reporting
3. Creates `/usr/local/share/hangartrak-radar/uuid` with the feeder identifier
4. Restarts readsb to apply the new configuration

---

## 7. Authentication & Authorization

### 7.1 Auth System
- **Provider:** Better Auth with email/password
- **Session Duration:** 7 days
- **Session Refresh:** 24-hour update window
- **Cookie:** `better-auth.session_token`
- **Password Requirements:** Minimum 8 characters

### 7.2 Route Protection

| Route Pattern | Protection | Redirect |
|---------------|-----------|----------|
| `/dashboard/*` | Requires session | → `/login` |
| `/feeders/*` | Requires session | → `/login` |
| `/api-keys/*` | Requires session | → `/login` |
| `/login`, `/register` | No session | → `/dashboard` |
| `/api/v1/*` | API key | 401 response |
| `/api/feeders/*` | Session | 401 response |
| `/leaderboard`, `/docs/*` | Public | None |

### 7.3 API Key Format
```
adsb_live_ + 32 random hex characters
Example: adsb_live_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6
```

---

## 8. Feeder Onboarding Flow

```
1. User registers account at radar.hangartrak.com
2. User navigates to /feeders and clicks "Add Feeder"
3. User provides feeder name and optional location
4. System generates UUID and displays install command
5. User runs install script on their Raspberry Pi
6. Script configures Beast output to aggregator :30004
7. Script installs stats reporter systemd service
8. Pi begins sending ADS-B data and heartbeat reports
9. First heartbeat auto-upgrades user to FEEDER tier
10. Feeder appears on dashboard with live stats
```

### 8.1 Pi Requirements
- Raspberry Pi (any model) with RTL-SDR dongle
- readsb or dump1090-fa installed and receiving ADS-B
- Network connectivity to `radar.hangartrak.com:30004` (Beast TCP)
- Network connectivity to `radar.hangartrak.com:443` (HTTPS for heartbeat)
- `curl` and `systemd` available

### 8.2 Stats Reporter
The installed systemd service (`hangartrak-radar-stats`) runs continuously and:
- Reads local readsb stats every 30 seconds
- Calculates deltas for messages and positions since last report
- POSTs to `/api/v1/feeders/:uuid/heartbeat`
- Auto-restarts on failure with systemd watchdog

---

## 9. User Interface

### 9.1 Pages

| Page | Route | Access | Description |
|------|-------|--------|-------------|
| Landing | `/` | Public | Product overview, sign-up CTA |
| Login | `/login` | Public | Email/password login |
| Register | `/register` | Public | Account creation |
| Dashboard | `/dashboard` | Auth | Stats overview, quick actions |
| My Feeders | `/feeders` | Auth | Feeder list, add new |
| Feeder Detail | `/feeders/[id]` | Auth | Individual feeder stats |
| Statistics | `/stats` | Auth | Network-wide statistics |
| API Keys | `/api-keys` | Auth | Key generation & management |
| Leaderboard | `/leaderboard` | Public | Top feeders ranked by stats |
| API Docs | `/docs/api` | Public | API reference documentation |
| Live Map | External | Public | tar1090 at map.hangartrak.com |

### 9.2 Dashboard Widgets
- **My Feeders** - Count of registered feeders
- **My Messages** - Total messages across all feeders
- **Live Aircraft** - Current aircraft count from aggregator
- **API Tier** - Current tier and rate limit
- **Network Stats** - Total feeders, messages, aircraft tracked
- **Recent Feeders** - Top 5 feeders by activity

### 9.3 Design System
- **Framework:** Tailwind CSS with shadcn/ui components
- **Components:** Card, Button, Dialog, Badge, Tabs, Input, Label, Toast, Tooltip, Avatar, Progress, Separator, Dropdown
- **Layout:** Fixed header + collapsible sidebar + main content area
- **Responsive:** Mobile-friendly with hidden sidebar on small screens

---

## 10. Integration with HangarTrak

### 10.1 Data Source Priority (in HangarTrak)
```
1. Local dump1090 (user's own Pi, if configured)
2. HangarTrak Radar API (this system)
3. adsb.lol API (last-resort fallback)
```

### 10.2 HangarTrak Changes Required
1. Add `HANGARTRAK_RADAR_URL` environment variable
2. Create HangarTrak Radar data source adapter in `lib/adsb/data-sources.ts`
3. Update fallback chain to prefer HangarTrak Radar over adsb.lol
4. Generate and configure API key with FEEDER tier

### 10.3 API Compatibility
The `/api/v1/aircraft` response format is designed to be compatible with common ADS-B API formats (similar to adsb.lol, adsbexchange), making integration straightforward.

---

## 11. Security Considerations

### 11.1 Authentication
- Passwords hashed by Better Auth (bcrypt)
- Session tokens stored server-side in PostgreSQL
- HTTPS enforced via Traefik in production
- CSRF protection via Better Auth

### 11.2 API Security
- API keys are unique, random, and revocable
- Rate limiting prevents abuse (in-memory store, per-key)
- Feeder heartbeat authenticated by UUID knowledge
- No sensitive data in public API responses (locations hidden for FREE tier)

### 11.3 Infrastructure
- PostgreSQL credentials via environment variables
- Docker network isolation between services
- No direct database exposure to internet
- Beast TCP port (:30004) accepts only inbound connections

### 11.4 Known Limitations
- Rate limiting is in-memory (not shared across processes/instances)
- Feeder UUID is the only heartbeat authentication (no additional secret)
- No email verification enforcement currently

---

## 12. Performance Characteristics

### 12.1 Data Freshness
| Data Point | Update Interval | Source |
|-----------|----------------|--------|
| Aircraft positions | ~1 second | readsb JSON |
| Feeder stats | 30 seconds | Heartbeat POST |
| Dashboard data | 30 seconds | SWR polling |
| Feeder online status | 60-second timeout | Heartbeat absence |

### 12.2 Scalability Considerations
- readsb handles hundreds of concurrent Beast connections
- Next.js API routes are stateless (horizontally scalable with shared DB)
- Rate limit store would need Redis/shared store for multi-process
- FeederStats table will grow; consider retention policy for old data
- tar1090 JSON file read is the bottleneck for aircraft API (single file)

---

## 13. Implementation Status

### Completed (Phases 1-5)
- [x] Docker aggregator (readsb + tar1090)
- [x] Next.js project with App Router
- [x] PostgreSQL database with Prisma schema & migrations
- [x] Better Auth (email/password login/register)
- [x] Feeder registration with UUID generation
- [x] Personalized install script generation
- [x] Feeder self-reporting (heartbeat API)
- [x] Public API v1 (aircraft, stats, feeders)
- [x] API key generation and tier-based rate limiting
- [x] Dashboard UI with shadcn/ui
- [x] Landing page
- [x] HangarTrak branding throughout

### Remaining (Phase 6: Polish & Launch)
- [ ] Leaderboard page completion (API exists, UI needs work)
- [ ] Historical charts (FeederStats over time using Recharts)
- [ ] Rate limiting middleware hardening
- [ ] API documentation page content
- [ ] Mobile responsive refinements
- [ ] Production deployment to Dokploy

### Future (Phase 7: Integration)
- [ ] Update HangarTrak to use this API as primary data source
- [ ] Implement fallback chain in HangarTrak
- [ ] End-to-end testing with live feeders
- [ ] Pro tier with Stripe subscription (Subscription model exists)

---

## 14. Environment Configuration

### Required Variables
```bash
DATABASE_URL="postgresql://user:password@host:5432/dbname"
BETTER_AUTH_SECRET="<openssl rand -base64 32>"
BETTER_AUTH_URL="https://radar.hangartrak.com"
NEXT_PUBLIC_APP_URL="https://radar.hangartrak.com"
NEXT_PUBLIC_MAP_URL="https://map.hangartrak.com"
READSB_JSON_URL="http://hangartrak-radar:8080/data/aircraft.json"
```

### Development
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/adsb"
BETTER_AUTH_SECRET="dev-secret-change-in-production"
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_MAP_URL="http://localhost:8080"
READSB_JSON_URL="http://localhost:8080/data/aircraft.json"
```

---

## 15. Development Commands

```bash
# Application
npm run dev                    # Start development server
npm run build                  # Production build
npm run start                  # Start production server
npm run lint                   # Run ESLint

# Database
npx prisma migrate dev --name <name>   # Create migration
npx prisma generate                     # Generate client
npx prisma studio                       # Visual DB editor
npx prisma db push                      # Push schema (no migration)

# Aggregator
docker build -t hangartrak-radar ./docker/aggregator
docker run --name hangartrak-radar -p 30004:30004 -p 8080:80 hangartrak-radar

# Stats Worker (future)
npm run worker                 # Background stats collection
```

---

## 16. File Structure

```
adsb/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Login, Register
│   ├── (dashboard)/              # Dashboard, Feeders, Stats, API Keys
│   ├── (public)/                 # Leaderboard, API Docs
│   ├── api/                      # API Routes
│   │   ├── v1/                   # Public API (aircraft, stats, feeders, heartbeat)
│   │   ├── feeders/              # User feeder management
│   │   ├── user/                 # API key management
│   │   ├── install/[uuid]/       # Install script generation
│   │   └── auth/[...all]/        # Better Auth catch-all
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Landing page
├── components/
│   ├── layout/                   # Header, Sidebar
│   └── ui/                       # shadcn/ui components
├── lib/
│   ├── auth.ts                   # Better Auth server config
│   ├── auth-client.ts            # Client auth hooks
│   ├── auth-server.ts            # Server auth helpers
│   ├── prisma.ts                 # Database client singleton
│   ├── readsb.ts                 # Aircraft data fetching
│   ├── utils.ts                  # Utilities (cn)
│   └── api/
│       ├── middleware.ts         # API auth & validation
│       ├── rate-limit.ts         # In-memory rate limiter
│       └── tiers.ts              # Tier rate limit config
├── prisma/
│   ├── schema.prisma             # Database models
│   └── migrations/               # SQL migrations
├── docker/
│   └── aggregator/
│       ├── Dockerfile            # readsb + tar1090
│       └── start.sh              # Container entrypoint
├── docs/
│   ├── PLAN.md                   # Implementation plan
│   └── PROJECT_SPEC.md           # This document
├── middleware.ts                  # Next.js route protection
├── package.json
├── Dockerfile                     # Next.js production image
├── CLAUDE.md                      # AI context file
└── .env.example                   # Environment template
```
