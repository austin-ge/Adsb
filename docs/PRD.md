# HangarTrak Radar - Product Requirements Document

## 1. Product Vision

**HangarTrak Radar** is a community-powered ADS-B feeder network that aggregates aircraft tracking data from distributed Raspberry Pi devices. It replaces the third-party adsb.lol dependency in [HangarTrak](https://hangartrak.com) with a first-party, controlled data source while also serving as a standalone public aircraft tracking platform.

---

## 2. Problem Statement

HangarTrak currently relies on:
1. A single local dump1090 receiver (limited range, single point of failure)
2. The adsb.lol API as a fallback (third-party dependency, rate limits, no SLA)

This creates fragility, limited coverage, and dependency on external services. HangarTrak Radar solves this by building a community feeder network that provides broader coverage, data ownership, and a public API others can use.

---

## 3. Target Users

| User Type | Description | Primary Goals |
|-----------|-------------|---------------|
| **Feeder Operator** | Aviation enthusiast with a Raspberry Pi + SDR setup | Contribute data, see stats, earn API access |
| **HangarTrak (Internal)** | The parent application | Reliable aircraft data without third-party dependency |
| **API Consumer** | Developer building aviation tools | Access live aircraft data via REST API |
| **Map Viewer** | Casual visitor | View live aircraft on an interactive map |

---

## 4. Goals & Success Metrics

### Goals
- Replace adsb.lol as HangarTrak's primary aircraft data source
- Build a network of community feeders providing broad geographic coverage
- Provide a polished, branded live aircraft map
- Offer a public API with tiered access for developers

### Success Metrics
| Metric | Target |
|--------|--------|
| Active feeders | 10+ feeders online |
| Geographic coverage | Multiple US regions covered |
| API uptime | 99.5%+ availability |
| Data freshness | Aircraft positions updated every 1 second |
| HangarTrak integration | Zero reliance on adsb.lol |

---

## 5. User Stories

### Feeder Operator
- As a feeder operator, I can register a new feeder and get a one-line install command so setup is effortless.
- As a feeder operator, I can see my feeder's live stats (messages, positions, aircraft seen) on my dashboard.
- As a feeder operator, I receive automatic API tier upgrade (FREE -> FEEDER) when my feeder starts reporting.
- As a feeder operator, I can manage multiple feeders from a single account.

### API Consumer
- As a developer, I can generate an API key to access live aircraft data.
- As a developer, I can filter aircraft by geographic bounds, altitude, and callsign.
- As a developer, I can look up a single aircraft by its ICAO hex code.
- As a developer, I can check network statistics to understand data quality.

### Map Viewer
- As a visitor, I can view all tracked aircraft on a live map without logging in.
- As a visitor, I can click an aircraft to see its callsign, altitude, speed, and heading.
- As a visitor, I can see flight trails showing where an aircraft has been.
- As a visitor, I can identify emergency squawks visually (color, pulsing, labels).

### HangarTrak Integration
- As the HangarTrak app, I can query the aircraft API to get live positions for flight tracking.
- As the HangarTrak app, I can fall back gracefully if HangarTrak Radar is unavailable.

---

## 6. Functional Requirements

### 6.1 Authentication & Accounts
| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| AUTH-1 | Email/password registration and login | P0 | Done |
| AUTH-2 | Session management with secure cookies | P0 | Done |
| AUTH-3 | Password reset flow | P1 | Planned |

### 6.2 Feeder Management
| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FEED-1 | Register feeder (name, optional location) | P0 | Done |
| FEED-2 | Generate unique UUID per feeder | P0 | Done |
| FEED-3 | Personalized install script (`curl \| bash`) | P0 | Done |
| FEED-4 | Feeder heartbeat API (stats self-reporting every 30s) | P0 | Done |
| FEED-5 | Online/offline status detection | P0 | Done |
| FEED-6 | Heartbeat token authentication (Bearer token) | P0 | Done |
| FEED-7 | Delete feeder | P0 | Done |
| FEED-8 | Edit feeder name/location | P1 | Planned |
| FEED-9 | Feeder health alerts (offline > 5 min) | P2 | Planned |

### 6.3 Live Map
| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| MAP-1 | Mapbox dark-style base map | P0 | Done |
| MAP-2 | Aircraft markers with heading rotation | P0 | Done |
| MAP-3 | Altitude-based color coding (green to purple) | P0 | Done |
| MAP-4 | Click-to-select with info panel | P0 | Done |
| MAP-5 | Auto-refresh at 1-second interval | P0 | Done |
| MAP-6 | Flight trails (full path, altitude colored) | P0 | Done |
| MAP-7 | Emergency squawk highlighting (7500/7600/7700) | P0 | Done |
| MAP-8 | Aircraft count overlay | P1 | Done |
| MAP-9 | Altitude legend | P1 | Done |
| MAP-10 | MLAT position indicator | P1 | Planned |
| MAP-11 | Aircraft type icons (jet, prop, helicopter) | P1 | Planned |
| MAP-12 | Range rings from feeder locations | P2 | Planned |
| MAP-13 | Aircraft list sidebar (sortable table) | P1 | Planned |
| MAP-14 | URL sharing (aircraft hex in URL) | P2 | Planned |
| MAP-15 | Dark/light mode toggle | P2 | Planned |
| MAP-16 | Metric/imperial unit toggle | P2 | Planned |
| MAP-17 | Historical playback | P3 | Planned |
| MAP-18 | Receiver coverage heatmap | P3 | Planned |
| MAP-19 | Search by callsign/hex/registration | P2 | Planned |

### 6.4 Public API
| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| API-1 | `GET /api/v1/aircraft` - all current aircraft | P0 | Done |
| API-2 | `GET /api/v1/aircraft/:hex` - single aircraft | P0 | Done |
| API-3 | `GET /api/v1/stats` - network statistics | P0 | Done |
| API-4 | `GET /api/v1/feeders` - feeder list | P0 | Done |
| API-5 | Aircraft filtering (bounds, altitude, callsign) | P0 | Done |
| API-6 | API key generation | P0 | Done |
| API-7 | Tier-based rate limiting (FREE/FEEDER/PRO) | P0 | In Progress |
| API-8 | API documentation page | P1 | Planned |
| API-9 | Webhook notifications (aircraft events) | P3 | Planned |

### 6.5 Dashboard & Stats
| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| DASH-1 | Network overview (total feeders, aircraft, messages) | P0 | Done |
| DASH-2 | User's feeder list with status indicators | P0 | Done |
| DASH-3 | Individual feeder detail page | P0 | Done |
| DASH-4 | API key management page | P0 | Done |
| DASH-5 | Leaderboard (top feeders by contribution) | P1 | Planned |
| DASH-6 | Historical charts (stats over time) | P1 | Planned |

### 6.6 HangarTrak Integration
| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| INT-1 | Aircraft API compatible with HangarTrak's expected format | P0 | Done |
| INT-2 | Add as data source in HangarTrak | P0 | Planned |
| INT-3 | Fallback chain: Local -> Radar -> adsb.lol | P0 | Planned |
| INT-4 | End-to-end integration testing | P0 | Planned |

---

## 7. Non-Functional Requirements

### Performance
| Requirement | Target |
|-------------|--------|
| Map refresh rate | 1 second |
| API response time (p95) | < 200ms |
| Heartbeat processing | < 50ms |
| Concurrent map viewers | 100+ |
| Concurrent feeders | 50+ |

### Security
| Requirement | Implementation |
|-------------|----------------|
| API key storage | SHA-256 hashed (plaintext shown once) |
| Heartbeat auth | Per-feeder Bearer tokens |
| Input validation | Zod schemas, name sanitization |
| Rate limiting | Per-key and per-IP limits |
| Install script safety | Feeder name sanitization to prevent injection |

### Reliability
| Requirement | Target |
|-------------|--------|
| Uptime | 99.5% |
| Data loss | Zero message loss from online feeders |
| Graceful degradation | Map works with partial feeder outages |

### Scalability
| Component | Scaling Strategy |
|-----------|-----------------|
| Feeders | Horizontal (add more Pis) |
| API | Vertical initially, horizontal with load balancer later |
| Database | Single PostgreSQL instance (sufficient for 50+ feeders) |
| Map | Client-side rendering, server provides JSON |

---

## 8. Technical Architecture

### System Components
```
┌──────────────────┐
│  Raspberry Pi(s) │  Community feeder devices
│  (readsb)        │
└────────┬─────────┘
         │ Beast Protocol (TCP :30004)
         ▼
┌──────────────────┐
│  Aggregator      │  readsb + tar1090 (Docker)
│  (hangartrak-    │  Combines all feeds into single stream
│   radar)         │
└────────┬─────────┘
         │ JSON (aircraft.json)
         ▼
┌──────────────────┐
│  Next.js Web App │  Dashboard, API, Map
│  (hangartrak-    │
│   radar-web)     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  PostgreSQL      │  Users, feeders, stats
│  (hangartrak-    │
│   radar-db)      │
└──────────────────┘
```

### Domain Architecture (Production)
| Domain | Service | Purpose |
|--------|---------|---------|
| `radar.hangartrak.com` | Next.js app | Dashboard, auth, management |
| `map.hangartrak.com` | tar1090 / Next.js map | Live aircraft visualization |
| `api.hangartrak.com/v1/` | Next.js API routes | Public REST API |

### Technology Stack
- **Runtime:** Node.js
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript 5.7
- **Database:** PostgreSQL + Prisma ORM 6.0
- **Auth:** Better Auth 1.0
- **UI:** Tailwind CSS + shadcn/ui (Radix primitives)
- **Map:** react-map-gl + Mapbox GL JS
- **Data Fetching:** SWR
- **Validation:** Zod
- **Deployment:** Dokploy on Hostinger VPS

---

## 9. API Tiers & Monetization

| Tier | Rate Limit | How to Get | Access |
|------|-----------|------------|--------|
| FREE | 100 req/min | Register an account | Basic aircraft data |
| FEEDER | 1,000 req/min | Run an active feeder | Full API, feeder locations |
| PRO | 10,000 req/min | Paid subscription (future) | Full API, priority, SLA |

### Future Monetization (P3)
- PRO tier via Stripe subscription
- Premium features: historical data access, webhook notifications, higher limits

---

## 10. Release Plan

### v0.1.0 - Foundation (Released)
- Project setup, auth, feeder CRUD, install scripts, basic API

### v0.2.0 - Self-Reporting (Released)
- Heartbeat API, auto tier upgrade, branding, leaderboard stub

### v0.3.0 - Live Map (In Progress)
- Mapbox map, altitude coloring, flight trails, emergency squawks
- Security hardening (hashed API keys, heartbeat tokens, input validation)

### v0.4.0 - Polish (Planned)
- Aircraft list sidebar, MLAT indicators, aircraft type icons
- Leaderboard, historical charts, rate limiting
- API documentation page

### v0.5.0 - Integration (Planned)
- HangarTrak integration (replace adsb.lol)
- End-to-end testing
- Production deployment to Dokploy

### v1.0.0 - Public Launch (Planned)
- Stable API, public documentation
- 10+ active feeders
- Full HangarTrak integration live

---

## 11. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Low feeder adoption | Limited coverage | Medium | Easy install, gamification (leaderboard) |
| Single VPS failure | Full outage | Low | Regular backups, monitoring, future multi-node |
| readsb memory usage with many feeds | Performance degradation | Low | Monitor, scale vertically |
| API abuse | Resource exhaustion | Medium | Rate limiting, API key required |
| Mapbox costs at scale | Increased hosting costs | Low | Free tier generous; switch to MapLibre if needed |

---

## 12. Out of Scope (for v1.0)

- Mobile native apps
- Real-time WebSocket streaming (polling is sufficient at 1s)
- MLAT computation (rely on feeder's local MLAT)
- Flight route prediction
- Integration with FAA/EUROCONTROL databases
- Multi-region deployment
- User-to-user messaging or social features

---

*Last Updated: January 22, 2026*