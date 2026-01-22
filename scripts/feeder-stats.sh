#!/bin/bash
#
# HangarTrak Radar - Feeder Stats Reporter
#
# Reads local readsb stats and reports them to the HangarTrak API.
# Similar pattern to adsbexchange-stats.
#
# Install: curl -sSL https://YOUR_DOMAIN/api/install/YOUR_UUID | sudo bash
#

# Configuration - these are replaced by the install script
REMOTE_URL="{{SERVER_URL}}/api/v1/feeders/{{UUID}}/heartbeat"
UUID="{{UUID}}"
UUID_FILE="/usr/local/share/hangartrak-radar/uuid"

# JSON source paths (in order of preference)
JSON_PATHS=("/run/readsb" "/run/dump1090-fa" "/run/dump1090")

# Timing
WAIT_TIME=30  # seconds between reports
MAX_CURL_TIME=10  # curl timeout

# Temp directory
TEMP_DIR="/run/hangartrak-radar-stats"
mkdir -p "$TEMP_DIR" 2>/dev/null

# Load UUID from file if not set
if [ -f "$UUID_FILE" ] && [ "x$UUID" = "x{{UUID}}" ]; then
    UUID=$(cat "$UUID_FILE")
fi

# Validate UUID
if ! [[ $UUID =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
    echo "FATAL: Invalid UUID [$UUID], exiting!"
    exit 1
fi

# Find JSON directory
JSON_DIR=""
for path in "${JSON_PATHS[@]}"; do
    if [ -d "$path" ]; then
        JSON_DIR="$path"
        break
    fi
done

if [ "x$JSON_DIR" = "x" ]; then
    echo "ERROR: Could not find readsb JSON directory. Tried: ${JSON_PATHS[*]}"
    exit 2
fi

echo "=========================================="
echo "HangarTrak Radar Stats Reporter"
echo "=========================================="
echo "UUID: $UUID"
echo "JSON Source: $JSON_DIR"
echo "Remote URL: $REMOTE_URL"
echo "Interval: ${WAIT_TIME}s"
echo "=========================================="

STATS_FILE="${JSON_DIR}/stats.json"
AIRCRAFT_FILE="${JSON_DIR}/aircraft.json"

# Track previous values for delta calculation
PREV_MESSAGES=0
PREV_POSITIONS=0

# Main loop
while true; do
    sleep $WAIT_TIME &
    SLEEP_PID=$!

    # Check if stats file exists
    if [ ! -f "$STATS_FILE" ]; then
        echo "WARNING: Stats file not found: $STATS_FILE"
        wait $SLEEP_PID
        continue
    fi

    # Read current stats
    NOW=$(date +%s)

    # Parse stats.json for totals
    if command -v jq &>/dev/null; then
        # Use jq if available
        MESSAGES=$(jq -r '.total.messages_valid // 0' "$STATS_FILE" 2>/dev/null)
        POSITIONS=$(jq -r '.total.position_count_total // 0' "$STATS_FILE" 2>/dev/null)
        AIRCRAFT=$(jq -r '.aircraft_with_pos // 0' "$STATS_FILE" 2>/dev/null)

        # Calculate deltas
        MSG_DELTA=$((MESSAGES - PREV_MESSAGES))
        POS_DELTA=$((POSITIONS - PREV_POSITIONS))

        # Handle counter resets
        if [ $MSG_DELTA -lt 0 ]; then MSG_DELTA=$MESSAGES; fi
        if [ $POS_DELTA -lt 0 ]; then POS_DELTA=$POSITIONS; fi

        PREV_MESSAGES=$MESSAGES
        PREV_POSITIONS=$POSITIONS

        # Build JSON payload
        PAYLOAD=$(jq -n \
            --arg uuid "$UUID" \
            --argjson now "$NOW" \
            --argjson aircraft "$AIRCRAFT" \
            --argjson messages "$MSG_DELTA" \
            --argjson positions "$POS_DELTA" \
            '{
                uuid: $uuid,
                now: $now,
                aircraft_with_pos: $aircraft,
                messages: $messages,
                positions: $positions
            }')
    else
        # Fallback without jq - basic parsing
        AIRCRAFT=$(grep -oP '"aircraft_with_pos"\s*:\s*\K\d+' "$STATS_FILE" 2>/dev/null || echo "0")
        PAYLOAD="{\"uuid\":\"$UUID\",\"now\":$NOW,\"aircraft_with_pos\":$AIRCRAFT,\"messages\":0,\"positions\":0}"
    fi

    # POST to API
    RESPONSE=$(curl -sS -m $MAX_CURL_TIME \
        -X POST \
        -H "Content-Type: application/json" \
        -d "$PAYLOAD" \
        "$REMOTE_URL" 2>&1)
    RV=$?

    if [ $RV -ne 0 ]; then
        echo "[$(date -Iseconds)] ERROR: curl failed (code $RV)"
    else
        # Check for success in response
        if echo "$RESPONSE" | grep -q '"success":true'; then
            echo "[$(date -Iseconds)] OK: aircraft=$AIRCRAFT msgs=$MSG_DELTA pos=$POS_DELTA"
        else
            echo "[$(date -Iseconds)] ERROR: $RESPONSE"
        fi
    fi

    wait $SLEEP_PID
done
