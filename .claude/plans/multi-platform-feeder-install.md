# Multi-Platform Feeder Install Script

**Status:** Planning complete, ready to implement
**Created:** January 25, 2026

---

## Task List

| # | Task | Status | Blocked By |
|---|------|--------|------------|
| 1 | Add softwareType field to Feeder model | pending | — |
| 2 | Update install script with multi-software detection | pending | #1 |
| 3 | Update stats reporter for all software types | pending | — |
| 4 | Update heartbeat endpoint to store software type | pending | #1 |
| 5 | Create installation documentation page | pending | — |
| 6 | Display software type on feeder detail page | pending | #1 |
| 7 | Test and verify multi-platform install | pending | #2, #3, #4, #5, #6 |

### Task Details

**#1 - Add softwareType field to Feeder model**
- File: `prisma/schema.prisma`
- Add `softwareType String?` to Feeder model
- Run migration
- Values: "ultrafeeder", "piaware", "fr24", "readsb", "dump1090-fa", "dump1090-mutability"

**#2 - Update install script with multi-software detection**
- File: `app/api/install/[uuid]/route.ts`
- Add `detect_feeder_software()` function
- Add configure functions for each software type
- Update main script flow to detect then configure

**#3 - Update stats reporter for all software types**
- File: `scripts/feeder-stats.sh`
- Add Docker volume path for ultrafeeder (`/opt/adsb/data/readsb/stats.json`)
- Add dump1090-mutability stats path
- Detect and send softwareType with heartbeat

**#4 - Update heartbeat endpoint to store software type**
- File: `app/api/v1/feeders/[uuid]/heartbeat/route.ts`
- Accept optional `softwareType` in request body
- Store on first heartbeat only
- Update Zod validation schema

**#5 - Create installation documentation page**
- File: `app/(public)/docs/install/page.tsx` (new)
- Auto-install instructions (curl one-liner)
- Tabbed manual instructions for each software type
- Troubleshooting section
- Verification steps

**#6 - Display software type on feeder detail page**
- File: `app/(dashboard)/feeders/[id]/page.tsx`
- Show software type if set (e.g., "Software: PiAware")

**#7 - Test and verify**
- Run build
- Test install script generation
- Verify docs page renders

---

## Overview

Extend the feeder install system to auto-detect and configure multiple ADS-B feeder software types, with fallback documentation for manual setup.

## Current State

The install script (`/app/api/install/[uuid]/route.ts`) currently:
- Detects readsb or ultrafeeder only
- Configures Beast net-connector
- Installs stats reporter service
- Stats reporter checks `/run/readsb`, `/run/dump1090-fa`, `/run/dump1090`

## Target Feeder Software

| Software | Detection Method | Config Location | Stats Location |
|----------|------------------|-----------------|----------------|
| **adsb.im / Ultrafeeder** | Docker container `ultrafeeder` | `/opt/adsb/.env` or compose file | `/run/readsb/stats.json` |
| **PiAware** | Service `piaware`, `/usr/bin/piaware` | `/etc/default/dump1090-fa` | `/run/dump1090-fa/stats.json` |
| **FR24 Pi Image** | Service `fr24feed` | `/etc/default/dump1090` | `/run/dump1090/stats.json` |
| **readsb standalone** | Service `readsb`, no Docker | `/etc/default/readsb` | `/run/readsb/stats.json` |
| **dump1090-mutability** | `/usr/bin/dump1090-mutability` | `/etc/default/dump1090-mutability` | `/run/dump1090-mutability/stats.json` |

## Implementation Details

### Auto-Detection Function

```bash
detect_feeder_software() {
  # Check for adsb.im/ultrafeeder (Docker-based)
  if docker ps 2>/dev/null | grep -q ultrafeeder; then
    echo "ultrafeeder"
  # Check for PiAware
  elif systemctl is-active --quiet piaware 2>/dev/null || [ -f /usr/bin/piaware ]; then
    echo "piaware"
  # Check for FR24 image
  elif systemctl is-active --quiet fr24feed 2>/dev/null; then
    echo "fr24"
  # Check for standalone readsb
  elif systemctl is-active --quiet readsb 2>/dev/null; then
    echo "readsb"
  # Check for dump1090-mutability
  elif [ -f /usr/bin/dump1090-mutability ]; then
    echo "dump1090-mutability"
  # Check for dump1090-fa without piaware
  elif systemctl is-active --quiet dump1090-fa 2>/dev/null; then
    echo "dump1090-fa"
  else
    echo "unknown"
  fi
}
```

### Per-Software Configuration

```bash
configure_ultrafeeder() {
  # Add to ULTRAFEEDER_CONFIG in .env
  ENV_FILE="/opt/adsb/.env"
  # Append: mlathub,SERVER,30004,beast_reduce_plus_out
}

configure_piaware() {
  # Add net-connector to /etc/default/dump1090-fa
  # Restart dump1090-fa service
}

configure_readsb() {
  # Current implementation - add to /etc/default/readsb
}

configure_fr24() {
  # Similar to piaware - edit /etc/default/dump1090
}

configure_dump1090_mutability() {
  # Edit /etc/default/dump1090-mutability
}
```

### Database Schema Change

```prisma
model Feeder {
  // existing fields...
  softwareType  String?   // "ultrafeeder", "piaware", "fr24", "readsb", "dump1090-fa", "dump1090-mutability"
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `app/api/install/[uuid]/route.ts` | Add multi-software detection and config |
| `scripts/feeder-stats.sh` | Add Docker stats path, send software type |
| `app/(public)/docs/install/page.tsx` | New documentation page |
| `prisma/schema.prisma` | Add `softwareType` field |
| `app/api/v1/feeders/[uuid]/heartbeat/route.ts` | Accept and store software type |
| `app/(dashboard)/feeders/[id]/page.tsx` | Display software type |

## Verification

1. **Test auto-detection** on a Pi with different setups
2. **Test install script** generates correct config for each type
3. **Verify stats reporter** finds stats.json in all locations
4. **Check documentation** renders correctly with tabs
5. **Run build** to ensure no TypeScript errors

## Out of Scope

- Custom protocols (only Beast TCP supported)
- Windows/Mac feeders
- Non-Raspberry Pi devices (should still work, just not tested)
