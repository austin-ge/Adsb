# Changelog

All notable changes to HangarTrak Radar will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added
- Aircraft list sidebar on map page with search filtering, sortable columns (callsign, altitude, speed, squawk, distance), click-to-fly-to selection, and collapsible panel
- Live aircraft map page with Mapbox visualization and altitude-based color coding
- Map API endpoint (`/api/map/aircraft`) for frontend map data
- Emergency squawk highlighting (7500/7600/7700) with pulsing rings, color override, enlarged icons, info panel banner, legend entries, and stats counter
- Heartbeat token authentication for feeder stats reporting (Bearer token in Authorization header)
- Rate limiting on heartbeat endpoint (10 req/min per feeder) and map endpoint (60 req/min per IP)
- Input validation for feeder names (alphanumeric + safe chars, max 64 chars) and coordinates (lat/lng bounds)

### Changed
- API keys are now stored as SHA-256 hashes in the database (plaintext key shown only once on generation)
- Install script sanitizes feeder names before embedding in shell scripts to prevent command injection
- Feeder creation generates a unique `heartbeatToken` stored on the Pi during install

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
