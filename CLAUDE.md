# ADS-B Aggregator - Claude Context File

## Project Overview
ADS-B Aggregator is a community-powered flight tracking platform that receives ADS-B data feeds from Raspberry Pi devices running readsb, displays live aircraft on a tar1090 map, and provides a dashboard for feeder management, statistics, and API access.

**Status:** Phase 1 - Initial Setup
**Target:** Multi-user ADS-B aggregator with tiered API access

## Documentation
- **[docs/PLAN.md](./docs/PLAN.md)** - Complete implementation plan, architecture, phases, deployment

## Architecture

### Dokploy Applications (3 separate services)
1. **adsb-aggregator** - readsb + tar1090 (Docker)
   - TCP :30004 - Beast input from feeders
   - HTTP :8080 - tar1090 map UI
2. **adsb-web** - Next.js dashboard (this repo)
   - User accounts, feeder management, API
3. **adsb-db** - PostgreSQL (Dokploy managed)

### Data Flow
```
Pi (readsb) --Beast--> adsb-aggregator:30004 --> JSON --> tar1090:8080
                                                     \--> Next.js API
```

## Technology Stack
- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Next.js API Routes, Prisma ORM, PostgreSQL, Better Auth
- **Aggregator:** readsb (network-only mode), tar1090
- **Infrastructure:** Dokploy on Hostinger VPS

## Quick Reference

### Essential Environment Variables
```bash
DATABASE_URL="postgresql://..."
BETTER_AUTH_SECRET="..."  # Generate: openssl rand -base64 32
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
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
docker build -t adsb-aggregator ./docker/aggregator
docker run -p 30004:30004 -p 8080:80 adsb-aggregator
```

### Project Structure
```
adsb/
├── app/                     # Next.js App Router
│   ├── (auth)/              # Auth pages
│   ├── (dashboard)/         # Dashboard pages
│   └── api/                 # API routes
│       └── v1/              # Public API
├── components/              # React components
│   └── ui/                  # shadcn/ui
├── lib/                     # Utilities
│   ├── prisma.ts            # Database client
│   ├── auth.ts              # Better Auth config
│   ├── auth-client.ts       # Better Auth React client
│   ├── readsb.ts            # Aircraft data fetching
│   └── api/                 # API middleware
├── prisma/                  # Database schema
├── docker/
│   └── aggregator/          # readsb + tar1090 Docker
├── scripts/                 # Background workers, install scripts
├── docs/
│   └── PLAN.md              # Implementation plan
├── Dockerfile               # Next.js production build
└── CLAUDE.md                # This file
```

### Database Models
- **User** - Account with API key and tier
- **Feeder** - Pi device sending data (UUID, stats, location)
- **FeederStats** - Historical statistics (hourly snapshots)
- **Subscription** - Future Stripe integration

### API Tiers
| Tier | Rate Limit | Access |
|------|------------|--------|
| FREE | 100 req/min | Basic endpoints |
| FEEDER | 1000 req/min | Full API (active feeders) |
| PRO | 10000 req/min | Full API + priority (future) |

### Key Patterns
- API key via `x-api-key` header
- Rate limiting in `lib/api/middleware.ts`
- Aircraft data from tar1090 JSON endpoint
- Feeders connect via readsb `--net-connector`

## Implementation Phases

### Phase 1: Infrastructure (Current)
- [x] Aggregator Dockerfile (readsb + tar1090)
- [x] Next.js project setup
- [x] Prisma schema
- [ ] Test aggregator with Pi

### Phase 2: Dashboard Foundation
- [ ] Authentication (login/register)
- [ ] User dashboard
- [ ] Deploy to Dokploy

### Phase 3: Feeder Management
- [ ] Feeder registration
- [ ] Personalized install scripts
- [ ] Feeder status tracking

### Phase 4: Statistics & Leaderboards
- [ ] Background stats worker
- [ ] Leaderboard page
- [ ] Historical charts

### Phase 5: Public API
- [ ] API key generation
- [ ] Rate limiting
- [ ] Documentation

### Phase 6: Polish & Launch
- [ ] Landing page
- [ ] Mobile responsive
- [ ] Documentation

---
**Last Updated:** January 2026
