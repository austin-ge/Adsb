#!/bin/bash
# Startup script for ADS-B Aggregator (readsb + tar1090)

set -e

# Configuration (can be overridden via environment variables)
BEAST_INPUT_PORT="${BEAST_INPUT_PORT:-30004}"
JSON_DIR="${JSON_DIR:-/run/readsb}"
JSON_INTERVAL="${JSON_INTERVAL:-1}"

echo "Starting ADS-B Aggregator..."
echo "  Beast input port: $BEAST_INPUT_PORT"
echo "  JSON output: $JSON_DIR"

# Ensure JSON directory exists
mkdir -p "$JSON_DIR"

# Start readsb in network-only mode (no SDR, just aggregating feeds)
echo "Starting readsb in aggregator mode..."
/usr/local/bin/readsb \
    --net-only \
    --net-bi-port="$BEAST_INPUT_PORT" \
    --write-json="$JSON_DIR" \
    --write-json-every="$JSON_INTERVAL" \
    --json-location-accuracy=2 \
    --quiet \
    &

READSB_PID=$!
echo "readsb started with PID $READSB_PID"

# Wait for readsb to create JSON files
sleep 2

# Start lighttpd for tar1090 web interface
echo "Starting lighttpd for tar1090..."
lighttpd -f /etc/lighttpd/lighttpd.conf -D &
LIGHTTPD_PID=$!
echo "lighttpd started with PID $LIGHTTPD_PID"

# Graceful shutdown handler
shutdown() {
    echo "Shutting down..."
    kill -TERM "$READSB_PID" 2>/dev/null || true
    kill -TERM "$LIGHTTPD_PID" 2>/dev/null || true
    wait
    echo "Shutdown complete"
    exit 0
}

trap shutdown SIGTERM SIGINT

echo "ADS-B Aggregator running!"
echo "  tar1090 available at http://localhost:80"
echo "  Feeders should connect to port $BEAST_INPUT_PORT"
echo ""

# Wait for either process to exit
wait -n $READSB_PID $LIGHTTPD_PID

# If we get here, one process died - exit with error
echo "A process exited unexpectedly!"
exit 1
