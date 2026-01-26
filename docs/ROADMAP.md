# HangarTrak Radar - Development Roadmap

**Created:** January 25, 2026
**Based on:** Competitive analysis of FlightRadar24 and AirNav RadarBox

---

## Current State (Phase 6 Complete)

### What We Have
- Live map with Mapbox, altitude coloring, aircraft type icons
- Flight trails for selected aircraft
- Emergency squawk highlighting (7500/7600/7700)
- Aircraft list sidebar (sortable, searchable)
- Historical playback with timeline, speed control, interpolation
- Flight search & replay
- Receiver coverage visualization
- Basic feeder dashboard with stats
- API with rate limiting and tiers

### What's Missing (from competitive analysis)
- Advanced feeder scoring/ranking system
- Feeder range tracking (max/avg)
- Data source indicators (ADS-B vs MLAT)
- Weather overlays
- Advanced filtering (airline, altitude, aircraft type)
- Day/night terminator
- More map customization options

---

## Phase 7: Feeder Dashboard Enhancement

**Goal:** Match RadarBox's feeder analytics to increase feeder engagement

### 7.1 - Feeder Scoring System
**Priority:** High | **Effort:** Medium

- [ ] Calculate composite score from multiple metrics:
  - Uptime percentage (weight: 30%)
  - Message rate (weight: 25%)
  - Position rate (weight: 25%)
  - Aircraft count (weight: 20%)
- [ ] Store daily score snapshots in `FeederStats`
- [ ] Display score prominently on feeder detail page
- [ ] Add score column to leaderboard

**Database Changes:**
```prisma
model FeederStats {
  // existing fields...
  score       Int?      // Composite score for this period
  maxRange    Float?    // Max range seen (nautical miles)
  avgRange    Float?    // Average range
}
```

### 7.2 - Range Tracking
**Priority:** High | **Effort:** Medium

- [ ] Calculate distance from feeder to each aircraft position
- [ ] Track max range and average range per feeder
- [ ] Store in `FeederStats` hourly snapshots
- [ ] Display on feeder detail page with historical chart
- [ ] Add range columns to leaderboard (sortable)

**Implementation:**
- Haversine formula for distance calculation
- Calculate during heartbeat processing
- Update feeder record with running max

### 7.3 - Uptime Visualization
**Priority:** Medium | **Effort:** Low

- [ ] Create uptime chart component (7-day view like RadarBox)
- [ ] Color coding: green=online, gray=no data, red=offline
- [ ] Show on feeder detail page
- [ ] Calculate uptime percentage from heartbeat gaps

### 7.4 - Enhanced Leaderboard
**Priority:** High | **Effort:** Medium

- [ ] Add regional rankings (country, state/province)
- [ ] Filter by receiver type (if we track this)
- [ ] Add columns: Max Range, Avg Range, Score
- [ ] Search by feeder name/location
- [ ] Show rank change indicators (↑↓)

### 7.5 - Feeder Detail Page Improvements
**Priority:** Medium | **Effort:** Medium

- [ ] Daily message stats table (last 7 days)
- [ ] "Last 20 tracked flights" section
- [ ] Nearby airports with distance
- [ ] Monthly summary stats
- [ ] Share button for feeder stats

---

## Phase 8: Map Feature Parity

**Goal:** Add key features from FR24/RadarBox that enhance usability

### 8.1 - Data Source Indicators
**Priority:** High | **Effort:** Medium

- [ ] Track data source per aircraft (ADS-B, MLAT, estimated)
- [ ] Display source in aircraft info panel
- [ ] Add source filter toggle
- [ ] Visual indicator on map (different icon opacity or badge)

**Note:** Requires changes to how we receive/store aircraft data

### 8.2 - Position Estimation
**Priority:** Medium | **Effort:** Medium

- [ ] Continue showing aircraft for N minutes after last position
- [ ] Extrapolate position based on last heading/speed
- [ ] Visual indicator for estimated positions (dashed trail, faded icon)
- [ ] User setting: estimation timeout (15/30/60 min)

### 8.3 - Day/Night Terminator
**Priority:** Low | **Effort:** Low

- [ ] Add terminator layer to map
- [ ] Toggle in map settings
- [ ] Use mapbox-gl-terminator or custom implementation

### 8.4 - Enhanced Map Settings
**Priority:** Medium | **Effort:** Low

- [ ] Brightness slider
- [ ] Aircraft icon size options (75%/100%/125%/150%)
- [ ] More map styles (add dark radar, terrain)
- [ ] Persist settings to localStorage

### 8.5 - Trail Tooltips
**Priority:** Low | **Effort:** Low

- [ ] Show altitude/speed/time when hovering trail points
- [ ] Implement with Mapbox popup on hover

---

## Phase 9: Advanced Filtering

**Goal:** Let users find specific aircraft quickly

### 9.1 - Aircraft Category Filter
**Priority:** High | **Effort:** Medium

- [ ] Filter by category:
  - Passenger
  - Cargo
  - Military
  - Business Jet
  - General Aviation
  - Helicopter
  - Drone
  - Ground Vehicle
- [ ] Map emitter category codes to friendly names
- [ ] Checkbox UI in filter panel
- [ ] Persist filter state

### 9.2 - Altitude/Speed Range Filter
**Priority:** Medium | **Effort:** Low

- [ ] Dual-handle range sliders
- [ ] Altitude: -1500 to 60000 ft
- [ ] Speed: 0 to 600 kts
- [ ] Real-time filtering

### 9.3 - Airline Filter (Future)
**Priority:** Low | **Effort:** High

- [ ] Requires airline database
- [ ] Parse callsign to airline code
- [ ] Searchable airline selector
- [ ] Multiple selection

### 9.4 - Filter Presets
**Priority:** Medium | **Effort:** Medium

- [ ] Save current filter as preset
- [ ] Quick-switch between presets
- [ ] Default presets: All, Emergencies, Military, Helicopters

---

## Phase 10: Weather Integration

**Goal:** Add aviation weather overlays for situational awareness

### 10.1 - Weather Radar Overlay
**Priority:** Medium | **Effort:** High

- [ ] Integrate NOAA/NWS radar data (free)
- [ ] Display precipitation overlay
- [ ] Opacity slider
- [ ] Auto-refresh every 5-10 min

**Data Sources:**
- NOAA MRMS (Multi-Radar Multi-Sensor)
- RainViewer API (free tier available)

### 10.2 - Cloud Coverage
**Priority:** Low | **Effort:** Medium

- [ ] Integrate satellite imagery
- [ ] Infrared cloud layer
- [ ] Toggle in weather panel

### 10.3 - Wind Barbs (Future)
**Priority:** Low | **Effort:** High

- [ ] Requires wind data at altitude
- [ ] Display as barbs or gradient
- [ ] Altitude selector

---

## Phase 11: User Experience Polish

**Goal:** Quality-of-life improvements

### 11.1 - Unit Preferences
**Priority:** High | **Effort:** Low

- [ ] Altitude: feet/meters
- [ ] Speed: knots/km/h/mph
- [ ] Distance: nm/km/mi
- [ ] Timezone: local/UTC
- [ ] Persist to user account or localStorage

### 11.2 - Keyboard Shortcuts
**Priority:** Medium | **Effort:** Low

- [ ] Space: play/pause playback
- [ ] Arrow keys: step through time
- [ ] Esc: deselect aircraft
- [ ] F: toggle follow mode
- [ ] /: focus search
- [ ] Help modal listing shortcuts

### 11.3 - Multi-Select Mode
**Priority:** Low | **Effort:** Medium

- [ ] Shift+click to add to selection
- [ ] Compare multiple aircraft
- [ ] Multi-trail display

### 11.4 - Data Export
**Priority:** Low | **Effort:** Medium

- [ ] Download flight track as CSV
- [ ] Download as KML for Google Earth
- [ ] Shareable flight replay links

---

## Phase 12: API & Integration

**Goal:** Prepare for HangarTrak integration and third-party use

### 12.1 - API Documentation
**Priority:** High | **Effort:** Medium

- [ ] Interactive API docs (Swagger/OpenAPI)
- [ ] Code examples (curl, JavaScript, Python)
- [ ] Rate limit documentation
- [ ] Webhook support for flight alerts (future)

### 12.2 - HangarTrak Integration
**Priority:** High | **Effort:** Medium

- [ ] Finalize API contract
- [ ] Add required endpoints for HangarTrak
- [ ] Test data flow
- [ ] Failover handling

### 12.3 - WebSocket Support (Future)
**Priority:** Low | **Effort:** High

- [ ] Real-time aircraft updates via WebSocket
- [ ] Reduce polling overhead
- [ ] Push notifications for alerts

---

## Implementation Timeline

### Q1 2026 (Now - March)
| Phase | Focus | Target |
|-------|-------|--------|
| **7.1-7.2** | Feeder scoring & range tracking | Feb 2026 |
| **7.3-7.4** | Uptime viz & enhanced leaderboard | Feb 2026 |
| **8.1** | Data source indicators | Mar 2026 |
| **11.1** | Unit preferences | Mar 2026 |

### Q2 2026 (April - June)
| Phase | Focus | Target |
|-------|-------|--------|
| **7.5** | Feeder detail improvements | Apr 2026 |
| **8.2-8.4** | Position estimation, map settings | Apr 2026 |
| **9.1-9.2** | Category & range filters | May 2026 |
| **12.1-12.2** | API docs & HangarTrak integration | Jun 2026 |

### Q3 2026 (July - September)
| Phase | Focus | Target |
|-------|-------|--------|
| **10.1** | Weather radar overlay | Jul 2026 |
| **9.4** | Filter presets | Aug 2026 |
| **11.2-11.4** | Keyboard, multi-select, export | Sep 2026 |

### Future (Q4+)
- Weather: cloud coverage, wind barbs
- Airline filtering (requires database)
- WebSocket real-time updates
- Mobile app consideration
- PRO tier with Stripe

---

## Success Metrics

### Feeder Engagement
- [ ] 50% increase in feeder signups after scoring launch
- [ ] Average session duration on feeder page > 2 min
- [ ] Leaderboard page views up 100%

### Map Usage
- [ ] Filter usage > 30% of sessions
- [ ] Playback usage > 15% of sessions
- [ ] Settings customization > 40% of users

### API Adoption
- [ ] HangarTrak fully migrated from adsb.lol
- [ ] 10+ external API consumers
- [ ] 99.9% API uptime

---

## Competitive Technical Analysis

### Tech Stack Comparison

| Aspect | FlightRadar24 | RadarBox | HangarTrak Radar |
|--------|---------------|----------|------------------|
| **Framework** | Vue.js 3 + Vite | React (likely) + Vite | Next.js 16 |
| **Map Library** | Google Maps + deck.gl (WebGL) | OpenLayers 10.4.0 | Mapbox GL JS |
| **Data Format** | gRPC-web (Protocol Buffers) | JSON (Axios) | JSON (SWR) |
| **State Management** | Pinia | Unknown | React state + SWR |
| **Offline/Caching** | Dexie.js (IndexedDB) | Unknown | None currently |
| **Auth** | OIDC | Custom | Better Auth |
| **Geo Indexing** | Unknown | H3 (Uber hexagonal) | None currently |

### Data Feed Architecture

| Metric | FlightRadar24 | RadarBox | HangarTrak Radar |
|--------|---------------|----------|------------------|
| **Endpoint** | `data-feed.flightradar24.com/fr24.feed.api.v1.Feed/LiveFeed` | REST JSON | `/api/map/aircraft` |
| **Protocol** | gRPC-web + Protobuf | HTTP/JSON | HTTP/JSON |
| **Poll Interval** | ~6 seconds | ~5-10 seconds | 1 second (SWR) |
| **Payload Size** | ~45KB (binary, compressed) | Unknown | ~20-50KB (JSON) |
| **Compression** | Yes (protobuf + gzip) | Yes | No |

### Feeder Station Naming Conventions (RadarBox)

| Prefix | Meaning |
|--------|---------|
| PGANRB | AirNav official hardware |
| EXTRPI | Raspberry Pi feeders |
| EXTSHA | Other external feeders |

### Key Technical Insights

1. **FR24 uses WebGL rendering** via deck.gl for aircraft layers - enables smooth rendering of thousands of aircraft
2. **FR24 gRPC-web** with Protocol Buffers provides ~50% smaller payloads than JSON
3. **RadarBox uses H3** (Uber's hexagonal hierarchical spatial index) for coverage heatmaps
4. **Both use sprite sheets** for aircraft icons rather than individual SVGs
5. **FR24 caches static data** (airports, airlines) in IndexedDB via Dexie.js
6. **RadarBox OpenLayers 10.4** provides native vector tile support

### Technical Recommendations for HangarTrak Radar

Based on competitive analysis, consider these optimizations:

**High Priority:**
- [ ] Enable gzip compression on API responses (nginx/Next.js)
- [ ] Implement aircraft icon sprite sheet (reduce HTTP requests)
- [ ] Add IndexedDB caching for static data (airports, aircraft types)

**Medium Priority:**
- [ ] Evaluate H3 for coverage heatmap calculations (more efficient than point-based)
- [ ] Consider deck.gl for WebGL aircraft rendering if performance becomes an issue at scale
- [ ] Reduce polling interval sensitivity (6s may be sufficient vs 1s)

**Lower Priority:**
- [ ] Investigate Protocol Buffers for API if bandwidth becomes a concern
- [ ] Add predictive position extrapolation (reduce perceived latency)

---

## Technical Debt to Address

- [ ] Redis-backed rate limiting (currently in-memory)
- [ ] Background job queue for heavy processing
- [ ] CDN for static assets
- [ ] Database connection pooling optimization
- [ ] Error monitoring (Sentry integration)
- [ ] Gzip compression on API responses
- [ ] Static data caching (IndexedDB)
- [ ] Aircraft icon sprite sheet optimization

---

*This roadmap is a living document. Update after each phase completion.*
