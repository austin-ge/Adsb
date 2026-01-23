import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ uuid: string }>;
}

// GET /api/install/[uuid] - Get personalized install script
export async function GET(request: Request, { params }: RouteParams) {
  const { uuid } = await params;

  // Verify the feeder UUID exists
  const feeder = await prisma.feeder.findUnique({
    where: { uuid },
    select: { id: true, name: true, uuid: true, heartbeatToken: true },
  });

  if (!feeder) {
    return new NextResponse(
      `#!/bin/bash
echo "Error: Invalid feeder UUID. Please check your registration at the dashboard."
exit 1
`,
      {
        status: 404,
        headers: {
          "Content-Type": "text/plain",
        },
      }
    );
  }

  // Sanitize feeder name for safe shell embedding (strip anything except safe chars)
  const safeName = feeder.name.replace(/[^a-zA-Z0-9 _\-\.]/g, "").slice(0, 64);

  // Get the server URL from environment or request
  const serverUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const serverHost = new URL(serverUrl).hostname;
  const beastPort = process.env.BEAST_PORT || "30004";

  const script = `#!/bin/bash
# HangarTrak Radar - Feeder Setup Script
# Feeder: ${safeName}
# UUID: ${feeder.uuid}
#
# This script configures your Raspberry Pi to:
# 1. Feed ADS-B data to the HangarTrak network (Beast protocol)
# 2. Report feeder stats to the API (for tracking/leaderboards)
#
# Run with: curl -sSL ${serverUrl}/api/install/${feeder.uuid} | sudo bash

set -e

FEEDER_UUID="${feeder.uuid}"
FEEDER_NAME="${safeName}"
HEARTBEAT_TOKEN="${feeder.heartbeatToken}"
SERVER="${serverHost}"
SERVER_URL="${serverUrl}"
BEAST_PORT="${beastPort}"

INSTALL_DIR="/usr/local/share/hangartrak-radar"
SERVICE_NAME="hangartrak-radar-stats"

echo "======================================"
echo "HangarTrak Radar - Feeder Setup"
echo "======================================"
echo ""
echo "Feeder Name: \${FEEDER_NAME}"
echo "Feeder UUID: \${FEEDER_UUID}"
echo "Server: \${SERVER}:\${BEAST_PORT}"
echo ""

# Check if running as root
if [ "\$EUID" -ne 0 ]; then
  echo "Error: This script must be run as root (sudo)"
  exit 1
fi

# Create install directory
mkdir -p "\$INSTALL_DIR"
chmod 700 "\$INSTALL_DIR"
echo "\$FEEDER_UUID" > "\$INSTALL_DIR/uuid"
echo "\$HEARTBEAT_TOKEN" > "\$INSTALL_DIR/token"
chmod 600 "\$INSTALL_DIR/token"

#######################################
# PART 1: Configure Beast Feed
#######################################

READSB_CONFIG="/etc/default/readsb"
ULTRAFEEDER_CONFIG="/opt/adsb/config/ultrafeeder/.env"

configure_readsb() {
  if [ -f "\$READSB_CONFIG" ]; then
    echo "Found readsb configuration at \$READSB_CONFIG"

    # Check if already configured for this server
    if grep -q "\${SERVER}.*\${BEAST_PORT}" "\$READSB_CONFIG" 2>/dev/null; then
      echo "Already configured to feed to \${SERVER}"
    else
      # Add net-connector (without UUID - stats are reported separately)
      if grep -q "NET_OPTIONS=" "\$READSB_CONFIG"; then
        # Append to existing NET_OPTIONS
        sed -i "s|NET_OPTIONS=\"\\(.*\\)\"|NET_OPTIONS=\"\\1 --net-connector=\${SERVER},\${BEAST_PORT},beast_reduce_plus_out\"|" "\$READSB_CONFIG"
      else
        echo "NET_OPTIONS=\"--net-connector=\${SERVER},\${BEAST_PORT},beast_reduce_plus_out\"" >> "\$READSB_CONFIG"
      fi
      echo "Beast feed configured. Will restart readsb after stats setup."
    fi
    return 0
  fi
  return 1
}

configure_ultrafeeder() {
  if [ -f "\$ULTRAFEEDER_CONFIG" ]; then
    echo "Found ultrafeeder configuration at \$ULTRAFEEDER_CONFIG"

    if grep -q "\${SERVER}" "\$ULTRAFEEDER_CONFIG" 2>/dev/null; then
      echo "Already configured to feed to \${SERVER}"
    else
      if grep -q "ULTRAFEEDER_CONFIG=" "\$ULTRAFEEDER_CONFIG"; then
        sed -i "s|ULTRAFEEDER_CONFIG=\"\\(.*\\)\"|ULTRAFEEDER_CONFIG=\"\\1;adsb,\${SERVER},\${BEAST_PORT},beast_reduce_plus_out\"|" "\$ULTRAFEEDER_CONFIG"
      else
        echo "ULTRAFEEDER_CONFIG=\"adsb,\${SERVER},\${BEAST_PORT},beast_reduce_plus_out\"" >> "\$ULTRAFEEDER_CONFIG"
      fi
      echo "Ultrafeeder configured. Please restart your container manually."
    fi
    return 0
  fi
  return 1
}

echo ""
echo "Configuring Beast feed..."
FEED_CONFIGURED=0
if configure_readsb; then FEED_CONFIGURED=1; fi
if configure_ultrafeeder; then FEED_CONFIGURED=1; fi

if [ \$FEED_CONFIGURED -eq 0 ]; then
  echo ""
  echo "Could not auto-configure feed. Manual configuration:"
  echo "  For readsb: --net-connector=\${SERVER},\${BEAST_PORT},beast_reduce_plus_out"
  echo "  For ultrafeeder: adsb,\${SERVER},\${BEAST_PORT},beast_reduce_plus_out"
fi

#######################################
# PART 2: Install Stats Reporter
#######################################

echo ""
echo "Installing stats reporter service..."

# Create the stats reporter script
cat > "\$INSTALL_DIR/feeder-stats.sh" << 'STATS_SCRIPT'
#!/bin/bash
#
# HangarTrak Radar - Feeder Stats Reporter
#

REMOTE_URL="__SERVER_URL__/api/v1/feeders/__UUID__/heartbeat"
UUID="__UUID__"
UUID_FILE="/usr/local/share/hangartrak-radar/uuid"
TOKEN_FILE="/usr/local/share/hangartrak-radar/token"
HEARTBEAT_TOKEN=""

JSON_PATHS=("/run/readsb" "/run/dump1090-fa" "/run/dump1090")
WAIT_TIME=30
MAX_CURL_TIME=10

TEMP_DIR="/run/hangartrak-radar-stats"
mkdir -p "\$TEMP_DIR" 2>/dev/null

# Load UUID from file
if [ -f "\$UUID_FILE" ]; then
    UUID=\$(cat "\$UUID_FILE")
fi

# Load heartbeat token from file
if [ -f "\$TOKEN_FILE" ]; then
    HEARTBEAT_TOKEN=\$(cat "\$TOKEN_FILE")
fi

if [ -z "\$HEARTBEAT_TOKEN" ]; then
    echo "FATAL: No heartbeat token found. Re-run the install script."
    exit 1
fi

# Validate UUID
if ! [[ \$UUID =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\$ ]]; then
    echo "FATAL: Invalid UUID [\$UUID]"
    exit 1
fi

# Find JSON directory
JSON_DIR=""
for path in "\${JSON_PATHS[@]}"; do
    if [ -d "\$path" ]; then
        JSON_DIR="\$path"
        break
    fi
done

if [ "x\$JSON_DIR" = "x" ]; then
    echo "ERROR: Could not find readsb JSON directory"
    exit 2
fi

echo "Stats Reporter: UUID=\$UUID JSON=\$JSON_DIR"

STATS_FILE="\${JSON_DIR}/stats.json"
PREV_MESSAGES=0
PREV_POSITIONS=0

while true; do
    sleep \$WAIT_TIME &
    SLEEP_PID=\$!

    if [ ! -f "\$STATS_FILE" ]; then
        wait \$SLEEP_PID
        continue
    fi

    NOW=\$(date +%s)

    if command -v jq &>/dev/null; then
        MESSAGES=\$(jq -r '.total.messages_valid // 0' "\$STATS_FILE" 2>/dev/null)
        POSITIONS=\$(jq -r '.total.position_count_total // 0' "\$STATS_FILE" 2>/dev/null)
        AIRCRAFT=\$(jq -r '.aircraft_with_pos // 0' "\$STATS_FILE" 2>/dev/null)

        MSG_DELTA=\$((MESSAGES - PREV_MESSAGES))
        POS_DELTA=\$((POSITIONS - PREV_POSITIONS))

        if [ \$MSG_DELTA -lt 0 ]; then MSG_DELTA=\$MESSAGES; fi
        if [ \$POS_DELTA -lt 0 ]; then POS_DELTA=\$POSITIONS; fi

        PREV_MESSAGES=\$MESSAGES
        PREV_POSITIONS=\$POSITIONS

        PAYLOAD=\$(jq -n \\
            --arg uuid "\$UUID" \\
            --argjson now "\$NOW" \\
            --argjson aircraft "\$AIRCRAFT" \\
            --argjson messages "\$MSG_DELTA" \\
            --argjson positions "\$POS_DELTA" \\
            '{uuid: \$uuid, now: \$now, aircraft_with_pos: \$aircraft, messages: \$messages, positions: \$positions}')
    else
        AIRCRAFT=\$(grep -oP '"aircraft_with_pos"\\s*:\\s*\\K\\d+' "\$STATS_FILE" 2>/dev/null || echo "0")
        PAYLOAD="{\"uuid\":\"\$UUID\",\"now\":\$NOW,\"aircraft_with_pos\":\$AIRCRAFT,\"messages\":0,\"positions\":0}"
        MSG_DELTA=0
        POS_DELTA=0
    fi

    RESPONSE=\$(curl -sS -m \$MAX_CURL_TIME -X POST -H "Content-Type: application/json" -H "Authorization: Bearer \$HEARTBEAT_TOKEN" -d "\$PAYLOAD" "\$REMOTE_URL" 2>&1)
    RV=\$?

    if [ \$RV -eq 0 ] && echo "\$RESPONSE" | grep -q '"success":true'; then
        echo "[\$(date -Iseconds)] OK: aircraft=\$AIRCRAFT msgs=\$MSG_DELTA pos=\$POS_DELTA"
    else
        echo "[\$(date -Iseconds)] ERROR: \$RESPONSE"
    fi

    wait \$SLEEP_PID
done
STATS_SCRIPT

# Replace placeholders
sed -i "s|__SERVER_URL__|${serverUrl}|g" "\$INSTALL_DIR/feeder-stats.sh"
sed -i "s|__UUID__|${feeder.uuid}|g" "\$INSTALL_DIR/feeder-stats.sh"
chmod +x "\$INSTALL_DIR/feeder-stats.sh"

# Create systemd service
cat > "/etc/systemd/system/\${SERVICE_NAME}.service" << EOF
[Unit]
Description=HangarTrak Radar Stats Reporter
After=network.target readsb.service

[Service]
Type=simple
ExecStart=\$INSTALL_DIR/feeder-stats.sh
Restart=always
RestartSec=30
User=root
Nice=19

[Install]
WantedBy=multi-user.target
EOF

# Enable and start the service
systemctl daemon-reload
systemctl enable "\${SERVICE_NAME}.service"
systemctl start "\${SERVICE_NAME}.service"

# Restart readsb if we configured it
if [ -f "\$READSB_CONFIG" ]; then
  echo ""
  echo "Restarting readsb..."
  systemctl restart readsb || true
fi

echo ""
echo "======================================"
echo "Setup Complete!"
echo "======================================"
echo ""
echo "Your feeder is now:"
echo "  1. Sending ADS-B data to \${SERVER}:\${BEAST_PORT}"
echo "  2. Reporting stats every 30 seconds"
echo ""
echo "View your feeder at:"
echo "  ${serverUrl}/feeders/\${FEEDER_UUID}"
echo ""
echo "Check service status:"
echo "  sudo systemctl status \${SERVICE_NAME}"
echo ""
echo "View logs:"
echo "  sudo journalctl -u \${SERVICE_NAME} -f"
echo ""
`;

  return new NextResponse(script, {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "Content-Disposition": `attachment; filename="install-${feeder.uuid}.sh"`,
    },
  });
}
