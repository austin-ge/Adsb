# ADS-B Aggregator Site - Implementation Plan

## Overview
Build an ADS-B flight data aggregator that receives feeds from Raspberry Pis running readsb, displays live aircraft using tar1090, and provides a custom Next.js dashboard with user accounts, feeder management, and analytics.

**Stack**: tar1090 + Next.js + readsb | PostgreSQL | Dokploy on Hostinger VPS

## Architecture (Matching HangarTrak Pattern)

Each service is a **separate Dokploy application** (no docker-compose):

```
┌─────────────────┐     ┌─────────────────────────────────────────────────────────────────┐
│  Raspberry Pi   │     │                     Dokploy (Separate Apps)                     │
│  (readsb)       │     │                                                                 │
│                 │     │  ┌─────────────────────────────────────────────────────────┐    │
│  Beast output   │────▶│  │  adsb-aggregator (readsb + tar1090)                    │    │
└─────────────────┘     │  │  - TCP :30004 (Beast input from feeders)               │    │
                        │  │  - HTTP :8080 (tar1090 map UI)                         │    │
                        │  │  - Writes JSON to shared volume                        │    │
                        │  └─────────────────────────────────────────────────────────┘    │
                        │                           │                                     │
                        │                           ▼ (reads JSON)                        │
                        │  ┌─────────────────────────────────────────────────────────┐    │
                        │  │  adsb-web (Next.js Dashboard)                          │    │
                        │  │  - User accounts & authentication                       │    │
                        │  │  - Feeder registration & management                     │    │
                        │  │  - Leaderboards & statistics                            │    │
                        │  │  - API for feeders                                      │    │
                        │  └─────────────────────────────────────────────────────────┘    │
                        │                           │                                     │
                        │                           ▼                                     │
                        │  ┌─────────────────────────────────────────────────────────┐    │
                        │  │  adsb-db (PostgreSQL - Dokploy managed)                 │    │
                        │  └─────────────────────────────────────────────────────────┘    │
                        └─────────────────────────────────────────────────────────────────┘

Dokploy Apps:
  1. adsb-aggregator  → readsb + tar1090 (Dockerfile)
  2. adsb-web         → Next.js dashboard (Dockerfile)
  3. adsb-db          → PostgreSQL (Dokploy database service)

Domains (via Traefik):
  yourdomain.com      → adsb-web:3000 (Next.js)
  map.yourdomain.com  → adsb-aggregator:8080 (tar1090)

Ports (direct, not proxied):
  :30004              → adsb-aggregator (Beast TCP for feeders)
```

## Technology Stack

| Component | Technology |
|-----------|------------|
| Live Map | tar1090 (industry standard, used by adsb.fi, airplanes.live) |
| Dashboard | Next.js 14 (App Router) + TypeScript |
| Auth | Better Auth or NextAuth.js v5 |
| Database | PostgreSQL (Dokploy managed) |
| Beast Server | readsb (aggregator mode) |
| Styling | Tailwind CSS + shadcn/ui |
| Deployment | Dokploy (separate apps, like HangarTrak) |
| VPS | Hostinger |

## Key Insight: Use readsb as the Aggregator

Instead of writing a custom Beast parser, use **readsb in network-only mode** as the aggregator:
- Handles Beast protocol parsing natively
- Outputs JSON for tar1090 and API consumption
- Battle-tested, handles edge cases
- Supports `--net-bi-port` for receiving Beast feeds

```bash
# readsb aggregator mode (no SDR, network only)
readsb --net-only \
  --net-bi-port=30004 \           # Accept Beast input from feeders
  --write-json=/run/readsb \      # JSON for tar1090 & Next.js
  --write-json-every=1
```

## Project Structure

```
adsb/
├── app/                              # Next.js App Router
│   ├── page.tsx                      # Landing page
│   ├── layout.tsx
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── dashboard/page.tsx        # User dashboard
│   │   ├── feeders/
│   │   │   ├── page.tsx              # Leaderboard
│   │   │   └── [id]/page.tsx         # Feeder details
│   │   └── settings/page.tsx
│   └── api/
│       ├── feeders/
│       │   ├── route.ts              # List/create feeders
│       │   └── [id]/
│       │       ├── route.ts          # Get/update feeder
│       │       └── stats/route.ts    # Feeder statistics
│       ├── stats/route.ts            # Global stats
│       ├── install/[uuid]/route.ts   # Personalized install script
│       │
│       └── v1/                       # Public API (versioned)
│           ├── aircraft/
│           │   ├── route.ts          # GET /api/v1/aircraft
│           │   └── [hex]/
│           │       ├── route.ts      # GET /api/v1/aircraft/:hex
│           │       └── trail/route.ts
│           ├── stats/route.ts        # GET /api/v1/stats
│           └── my/
│               ├── stats/route.ts    # Feeder's own stats
│               └── aircraft/route.ts # Aircraft seen by feeder
│
├── components/
│   ├── ui/                           # shadcn/ui components
│   ├── feeders/
│   │   ├── FeederCard.tsx
│   │   ├── FeederList.tsx
│   │   └── Leaderboard.tsx
│   ├── stats/
│   │   ├── StatsCard.tsx
│   │   └── GlobalStats.tsx
│   └── layout/
│       ├── Header.tsx
│       └── Sidebar.tsx
│
├── lib/
│   ├── prisma.ts                     # Prisma client
│   ├── auth.ts                       # Auth config (like HangarTrak)
│   ├── readsb.ts                     # Read readsb JSON files
│   ├── api/
│   │   ├── middleware.ts             # API key validation, rate limiting
│   │   ├── rate-limit.ts             # Rate limiter (in-memory or Redis)
│   │   └── tiers.ts                  # Tier definitions and limits
│   └── validations/                  # Zod schemas
│
├── prisma/
│   └── schema.prisma
│
├── scripts/
│   ├── install-feeder.sh             # Pi setup script template
│   └── stats-worker.ts               # Background stats collection
│
├── docker/
│   └── aggregator/
│       ├── Dockerfile                # readsb + tar1090 combined
│       └── start.sh                  # Startup script
│
├── Dockerfile                        # Next.js (like HangarTrak)
├── Dockerfile.worker                 # Stats worker (optional)
├── docker-entrypoint.sh
├── package.json
├── next.config.ts
└── CLAUDE.md                         # Project context (like HangarTrak)
```

## Database Schema (Prisma)

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  password  String   // hashed

  // API Access
  apiKey    String?  @unique           // Generated API key
  apiTier   ApiTier  @default(FREE)    // Current tier

  feeders   Feeder[]
  createdAt DateTime @default(now())
}

enum ApiTier {
  FREE        // 100 req/min, basic endpoints
  FEEDER      // 1000 req/min, auto-granted to active feeders
  PRO         // 10000 req/min, paid (future)
}

model Feeder {
  id            String   @id @default(cuid())
  uuid          String   @unique        // Beast feeder UUID
  name          String
  latitude      Float?
  longitude     Float?
  userId        String
  user          User     @relation(fields: [userId], references: [id])

  // Stats (updated periodically)
  messagesTotal BigInt   @default(0)
  positionsTotal BigInt  @default(0)
  aircraftSeen  Int      @default(0)
  lastSeen      DateTime?
  isOnline      Boolean  @default(false)

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  stats         FeederStats[]
}

model FeederStats {
  id            String   @id @default(cuid())
  feederId      String
  feeder        Feeder   @relation(fields: [feederId], references: [id])

  timestamp     DateTime @default(now())
  messages      Int                      // Messages in this period
  positions     Int                      // Positions in this period
  aircraft      Int                      // Unique aircraft seen

  @@index([feederId, timestamp])
}

// Future: for Stripe integration
model Subscription {
  id                String   @id @default(cuid())
  userId            String   @unique
  user              User     @relation(fields: [userId], references: [id])
  stripeCustomerId  String?
  stripePriceId     String?
  status            String   // active, canceled, past_due
  currentPeriodEnd  DateTime?
  createdAt         DateTime @default(now())
}
```

## Dokploy Configuration (Like HangarTrak)

### Dokploy Applications

**1. adsb-aggregator** (readsb + tar1090)
- Dockerfile: `docker/aggregator/Dockerfile`
- Ports: `30004:30004` (TCP, Beast input), `8080:80` (HTTP, tar1090)
- Domain: `map.yourdomain.com` → port 8080
- Volume: `/run/readsb` (for JSON output)

**2. adsb-web** (Next.js Dashboard)
- Dockerfile: `Dockerfile`
- Domain: `yourdomain.com` → port 3000
- Environment Variables:
  - `DATABASE_URL`
  - `NEXTAUTH_SECRET`
  - `NEXTAUTH_URL`
  - `AUTH_TRUST_HOST=true`
  - `READSB_JSON_URL=http://adsb-aggregator:8080/data/aircraft.json`

**3. adsb-db** (PostgreSQL)
- Dokploy managed database service
- Same setup as hangartrak-db

### Network Notes
- Dokploy apps can communicate via internal Docker network
- Next.js fetches JSON from tar1090's HTTP endpoint (no shared volume needed)
- Port 30004 must be exposed publicly for Pi feeders to connect

### SSL (Traefik)
- Dokploy handles Let's Encrypt automatically
- `yourdomain.com` → adsb-web
- `map.yourdomain.com` → adsb-aggregator (tar1090)

## Implementation Phases

### Phase 1: Aggregator Setup
1. Create `docker/aggregator/Dockerfile` with readsb + tar1090
2. Deploy adsb-aggregator to Dokploy
3. Open port 30004 on VPS firewall
4. Test feeder connection from your Pi
5. Verify tar1090 shows aircraft at `map.yourdomain.com`

### Phase 2: Next.js Dashboard Foundation
6. Initialize Next.js project (same structure as HangarTrak)
7. Set up Prisma + PostgreSQL
8. Implement authentication (NextAuth.js v5, like HangarTrak)
9. Create basic layout with shadcn/ui
10. Deploy adsb-web to Dokploy

### Phase 3: Feeder Management
11. Feeder registration flow (generates UUID)
12. User dashboard showing their feeders
13. Personalized install script endpoint (`/api/install/[uuid]`)
14. Feeder status tracking (read from readsb JSON)

### Phase 4: Statistics & Leaderboards
15. Background worker to collect feeder stats (like hangartrak-worker)
16. Feeder statistics page
17. Global leaderboard (top feeders)
18. Historical charts (Recharts, like HangarTrak)

### Phase 5: Public API
19. API key generation in user dashboard
20. Rate limiting middleware (in-memory for now)
21. Public API endpoints (`/api/v1/aircraft`, `/api/v1/stats`)
22. Auto-upgrade to FEEDER tier when actively feeding
23. API documentation page

### Phase 6: Polish & Launch
24. Landing page with network stats
25. Mobile-responsive design
26. Test end-to-end with your Pi
27. Documentation for new feeders
28. API usage examples

### Future: Paid Tier (Phase 7)
- Stripe integration
- Pro tier with higher rate limits
- Subscription management in dashboard
- Usage analytics

## Custom Features Beyond tar1090

### 1. User Accounts
- Email/password registration
- Each user can register multiple feeders
- Personal dashboard with feeder stats

### 2. Feeder Registration
- User registers feeder, gets unique UUID
- Personalized install script: `curl https://yourdomain.com/install/USER_UUID | sudo bash`
- Feeder location on optional coverage map

### 3. Leaderboards
- Top feeders by message count
- Top feeders by aircraft seen
- Coverage contributors (by geographic area)
- Daily/weekly/monthly rankings

### 4. Analytics
- Messages per hour/day graphs
- Aircraft seen over time
- Peak activity times
- Feeder uptime percentage

### 5. Public API with Tiered Access

**Access Model:**
- Active feeders → Free API access (automatic)
- Non-feeders → Must pay (Stripe, future)

**API Tiers:**
| Tier | Rate Limit | Access | Cost |
|------|------------|--------|------|
| Feeder | 1000 req/min | Full API | Free (while feeding) |
| Free | 100 req/min | Basic endpoints | Free |
| Pro | 10000 req/min | Full API + priority | $X/month (future) |

**API Endpoints:**
```
# Public (no auth required)
GET /api/v1/aircraft              - Current aircraft (rate limited)
GET /api/v1/stats                 - Network statistics

# Authenticated (API key required)
GET /api/v1/aircraft/:hex         - Single aircraft details
GET /api/v1/aircraft/:hex/trail   - Flight trail (Feeder/Pro only)
GET /api/v1/feeders/leaderboard   - Top feeders

# Feeder-specific
GET /api/v1/my/stats              - Your feeder stats
GET /api/v1/my/aircraft           - Aircraft seen by your feeder
```

**Implementation:**
- API keys generated per user in dashboard
- Middleware checks: API key → user → tier → rate limit
- Active feeder = received data in last 24 hours
- Rate limiting via Redis or in-memory (upstash for serverless)

## Pi Feeder Setup

### Personalized Install Script
When user registers a feeder, they get a custom URL:
```bash
curl -sSL https://yourdomain.com/install/abc123 | sudo bash
```

The script:
1. Detects readsb installation
2. Configures net-connector with user's UUID
3. Restarts readsb
4. Confirms connection to server

### install-feeder.sh template
```bash
#!/bin/bash
FEEDER_UUID="{{UUID}}"
SERVER="yourdomain.com"
PORT="30004"

# Add to readsb config
echo "Configuring feed to $SERVER..."
# ... configuration logic ...

echo "Done! Your feeder UUID: $FEEDER_UUID"
echo "View your stats at: https://$SERVER/feeders/$FEEDER_UUID"
```

## Critical Files

1. **docker/aggregator/Dockerfile** - readsb + tar1090 combined image
2. **docker/aggregator/start.sh** - Startup script for both services
3. **Dockerfile** - Next.js app (same pattern as HangarTrak)
4. **lib/prisma.ts** - Database client
5. **lib/auth.ts** - NextAuth configuration
6. **lib/api/middleware.ts** - API key validation + rate limiting
7. **lib/api/rate-limit.ts** - Rate limiter implementation
8. **app/api/feeders/route.ts** - Feeder registration API
9. **app/api/v1/aircraft/route.ts** - Public aircraft API
10. **app/api/install/[uuid]/route.ts** - Personalized install script
11. **app/(dashboard)/dashboard/page.tsx** - User dashboard
12. **prisma/schema.prisma** - Database schema
13. **scripts/install-feeder.sh** - Pi setup template

## Verification

### Local Development
```bash
# Start Next.js
npm run dev

# In separate terminal, run readsb + tar1090 via Docker
docker build -t adsb-aggregator ./docker/aggregator
docker run -p 30004:30004 -p 8080:80 adsb-aggregator

# Access tar1090 at http://localhost:8080
# Access Next.js at http://localhost:3000
# Connect your Pi to localhost:30004 for testing
```

### Database
```bash
npx prisma migrate dev --name init
npx prisma studio  # View data
```

### Testing Feeder Connection
```bash
# On your Pi, temporarily add this to readsb config:
--net-connector=YOUR_VPS_IP,30004,beast_reduce_plus_out

# Or test locally with:
--net-connector=localhost,30004,beast_reduce_plus_out
```

### Production Deployment
1. Create adsb-db in Dokploy (PostgreSQL)
2. Deploy adsb-aggregator app
   - Open port 30004 on VPS firewall
   - Configure domain `map.yourdomain.com`
3. Deploy adsb-web app
   - Set environment variables
   - Configure domain `yourdomain.com`
4. Test full flow: register → get install script → run on Pi → see stats

## Environment Variables

```bash
# adsb-web (Next.js)
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="https://yourdomain.com"
AUTH_TRUST_HOST=true
READSB_JSON_URL="http://adsb-aggregator:8080/data/aircraft.json"

# adsb-aggregator (readsb)
# None required - all configured in Dockerfile
```
