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
# Supported feeder software:
# - adsb.im / Ultrafeeder (Docker)
# - PiAware (FlightAware)
# - FR24 Pi Image (FlightRadar24)
# - readsb standalone
# - dump1090-fa
# - dump1090-mutability
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
# Feeder Software Detection
#######################################

detect_feeder_software() {
  # Check for adsb.im / Ultrafeeder (Docker-based)
  if command -v docker &>/dev/null; then
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -qi "ultrafeeder"; then
      echo "ultrafeeder"
      return
    fi
  fi

  # Check for PiAware
  if [ -f "/usr/bin/piaware" ] || systemctl is-active piaware &>/dev/null; then
    echo "piaware"
    return
  fi

  # Check for FR24 feeder
  if systemctl is-active fr24feed &>/dev/null || [ -f "/etc/fr24feed.ini" ]; then
    echo "fr24"
    return
  fi

  # Check for dump1090-mutability
  if [ -f "/usr/bin/dump1090-mutability" ] || [ -f "/etc/default/dump1090-mutability" ]; then
    echo "dump1090-mutability"
    return
  fi

  # Check for dump1090-fa (without piaware)
  if [ -f "/usr/bin/dump1090-fa" ] || [ -f "/etc/default/dump1090-fa" ]; then
    echo "dump1090-fa"
    return
  fi

  # Check for readsb standalone (systemd service, no Docker)
  if systemctl is-active readsb &>/dev/null || [ -f "/etc/default/readsb" ]; then
    echo "readsb"
    return
  fi

  echo "unknown"
}

#######################################
# PART 1: Configure Beast Feed
#######################################

configure_ultrafeeder() {
  echo "Configuring Ultrafeeder (Docker)..."

  # Check common adsb.im config locations
  local ENV_FILE=""
  if [ -f "/opt/adsb/.env" ]; then
    ENV_FILE="/opt/adsb/.env"
  elif [ -f "/opt/adsb/config/ultrafeeder/.env" ]; then
    ENV_FILE="/opt/adsb/config/ultrafeeder/.env"
  fi

  if [ -n "\$ENV_FILE" ]; then
    echo "Found Ultrafeeder config at \$ENV_FILE"

    if grep -q "\${SERVER}" "\$ENV_FILE" 2>/dev/null; then
      echo "Already configured to feed to \${SERVER}"
    else
      # Add to ULTRAFEEDER_CONFIG
      if grep -q "^ULTRAFEEDER_CONFIG=" "\$ENV_FILE"; then
        # Append to existing ULTRAFEEDER_CONFIG
        sed -i "s|^ULTRAFEEDER_CONFIG=\\(.*\\)\"|ULTRAFEEDER_CONFIG=\\1;adsb,\${SERVER},\${BEAST_PORT},beast_reduce_plus_out\"|" "\$ENV_FILE"
      else
        echo "ULTRAFEEDER_CONFIG=\"adsb,\${SERVER},\${BEAST_PORT},beast_reduce_plus_out\"" >> "\$ENV_FILE"
      fi
      echo "Ultrafeeder configured."
      echo ""
      echo "IMPORTANT: Please restart your Docker containers manually:"
      echo "  cd /opt/adsb && docker compose up -d"
    fi
  else
    echo "WARNING: Could not find Ultrafeeder config file."
    echo "Please add this to your ULTRAFEEDER_CONFIG:"
    echo "  adsb,\${SERVER},\${BEAST_PORT},beast_reduce_plus_out"
  fi
}

configure_piaware() {
  echo "Configuring PiAware / dump1090-fa..."

  local CONFIG_FILE="/etc/default/dump1090-fa"

  if [ -f "\$CONFIG_FILE" ]; then
    echo "Found dump1090-fa configuration at \$CONFIG_FILE"

    if grep -q "\${SERVER}.*\${BEAST_PORT}" "\$CONFIG_FILE" 2>/dev/null; then
      echo "Already configured to feed to \${SERVER}"
    else
      # Add net-connector to RECEIVER_OPTIONS or NET_OPTIONS
      if grep -q "^RECEIVER_OPTIONS=" "\$CONFIG_FILE"; then
        sed -i "s|^RECEIVER_OPTIONS=\"\\(.*\\)\"|RECEIVER_OPTIONS=\"\\1 --net-connector=\${SERVER},\${BEAST_PORT},beast_reduce_plus_out\"|" "\$CONFIG_FILE"
      elif grep -q "^NET_OPTIONS=" "\$CONFIG_FILE"; then
        sed -i "s|^NET_OPTIONS=\"\\(.*\\)\"|NET_OPTIONS=\"\\1 --net-connector=\${SERVER},\${BEAST_PORT},beast_reduce_plus_out\"|" "\$CONFIG_FILE"
      else
        echo "NET_OPTIONS=\"--net-connector=\${SERVER},\${BEAST_PORT},beast_reduce_plus_out\"" >> "\$CONFIG_FILE"
      fi
      echo "dump1090-fa configured. Will restart after stats setup."
    fi
  else
    echo "WARNING: Could not find dump1090-fa config at \$CONFIG_FILE"
    echo "Please add --net-connector=\${SERVER},\${BEAST_PORT},beast_reduce_plus_out to your configuration."
  fi
}

configure_fr24() {
  echo "Configuring FR24 Pi Image / dump1090..."

  local CONFIG_FILE="/etc/default/dump1090"

  if [ -f "\$CONFIG_FILE" ]; then
    echo "Found dump1090 configuration at \$CONFIG_FILE"

    if grep -q "\${SERVER}.*\${BEAST_PORT}" "\$CONFIG_FILE" 2>/dev/null; then
      echo "Already configured to feed to \${SERVER}"
    else
      if grep -q "^RECEIVER_OPTIONS=" "\$CONFIG_FILE"; then
        sed -i "s|^RECEIVER_OPTIONS=\"\\(.*\\)\"|RECEIVER_OPTIONS=\"\\1 --net-connector=\${SERVER},\${BEAST_PORT},beast_reduce_plus_out\"|" "\$CONFIG_FILE"
      elif grep -q "^EXTRA_OPTIONS=" "\$CONFIG_FILE"; then
        sed -i "s|^EXTRA_OPTIONS=\"\\(.*\\)\"|EXTRA_OPTIONS=\"\\1 --net-connector=\${SERVER},\${BEAST_PORT},beast_reduce_plus_out\"|" "\$CONFIG_FILE"
      else
        echo "EXTRA_OPTIONS=\"--net-connector=\${SERVER},\${BEAST_PORT},beast_reduce_plus_out\"" >> "\$CONFIG_FILE"
      fi
      echo "dump1090 configured. Will restart after stats setup."
    fi
  else
    echo "WARNING: Could not find dump1090 config at \$CONFIG_FILE"
    echo "Please add --net-connector=\${SERVER},\${BEAST_PORT},beast_reduce_plus_out to your configuration."
  fi
}

configure_readsb() {
  echo "Configuring readsb..."

  local CONFIG_FILE="/etc/default/readsb"

  if [ -f "\$CONFIG_FILE" ]; then
    echo "Found readsb configuration at \$CONFIG_FILE"

    if grep -q "\${SERVER}.*\${BEAST_PORT}" "\$CONFIG_FILE" 2>/dev/null; then
      echo "Already configured to feed to \${SERVER}"
    else
      if grep -q "^NET_OPTIONS=" "\$CONFIG_FILE"; then
        sed -i "s|^NET_OPTIONS=\"\\(.*\\)\"|NET_OPTIONS=\"\\1 --net-connector=\${SERVER},\${BEAST_PORT},beast_reduce_plus_out\"|" "\$CONFIG_FILE"
      else
        echo "NET_OPTIONS=\"--net-connector=\${SERVER},\${BEAST_PORT},beast_reduce_plus_out\"" >> "\$CONFIG_FILE"
      fi
      echo "readsb configured. Will restart after stats setup."
    fi
  else
    echo "WARNING: Could not find readsb config at \$CONFIG_FILE"
    echo "Please add --net-connector=\${SERVER},\${BEAST_PORT},beast_reduce_plus_out to your configuration."
  fi
}

configure_dump1090_fa() {
  echo "Configuring dump1090-fa (standalone)..."

  local CONFIG_FILE="/etc/default/dump1090-fa"

  if [ -f "\$CONFIG_FILE" ]; then
    echo "Found dump1090-fa configuration at \$CONFIG_FILE"

    if grep -q "\${SERVER}.*\${BEAST_PORT}" "\$CONFIG_FILE" 2>/dev/null; then
      echo "Already configured to feed to \${SERVER}"
    else
      if grep -q "^RECEIVER_OPTIONS=" "\$CONFIG_FILE"; then
        sed -i "s|^RECEIVER_OPTIONS=\"\\(.*\\)\"|RECEIVER_OPTIONS=\"\\1 --net-connector=\${SERVER},\${BEAST_PORT},beast_reduce_plus_out\"|" "\$CONFIG_FILE"
      elif grep -q "^NET_OPTIONS=" "\$CONFIG_FILE"; then
        sed -i "s|^NET_OPTIONS=\"\\(.*\\)\"|NET_OPTIONS=\"\\1 --net-connector=\${SERVER},\${BEAST_PORT},beast_reduce_plus_out\"|" "\$CONFIG_FILE"
      else
        echo "NET_OPTIONS=\"--net-connector=\${SERVER},\${BEAST_PORT},beast_reduce_plus_out\"" >> "\$CONFIG_FILE"
      fi
      echo "dump1090-fa configured. Will restart after stats setup."
    fi
  else
    echo "WARNING: Could not find dump1090-fa config at \$CONFIG_FILE"
    echo "Please add --net-connector=\${SERVER},\${BEAST_PORT},beast_reduce_plus_out to your configuration."
  fi
}

configure_dump1090_mutability() {
  echo "Configuring dump1090-mutability..."

  local CONFIG_FILE="/etc/default/dump1090-mutability"

  if [ -f "\$CONFIG_FILE" ]; then
    echo "Found dump1090-mutability configuration at \$CONFIG_FILE"

    if grep -q "\${SERVER}.*\${BEAST_PORT}" "\$CONFIG_FILE" 2>/dev/null; then
      echo "Already configured to feed to \${SERVER}"
    else
      if grep -q "^NET_OUTPUT_OPTIONS=" "\$CONFIG_FILE"; then
        sed -i "s|^NET_OUTPUT_OPTIONS=\"\\(.*\\)\"|NET_OUTPUT_OPTIONS=\"\\1 --net-connector=\${SERVER},\${BEAST_PORT},beast_reduce_plus_out\"|" "\$CONFIG_FILE"
      elif grep -q "^EXTRA_ARGS=" "\$CONFIG_FILE"; then
        sed -i "s|^EXTRA_ARGS=\"\\(.*\\)\"|EXTRA_ARGS=\"\\1 --net-connector=\${SERVER},\${BEAST_PORT},beast_reduce_plus_out\"|" "\$CONFIG_FILE"
      else
        echo "EXTRA_ARGS=\"--net-connector=\${SERVER},\${BEAST_PORT},beast_reduce_plus_out\"" >> "\$CONFIG_FILE"
      fi
      echo "dump1090-mutability configured. Will restart after stats setup."
    fi
  else
    echo "WARNING: Could not find dump1090-mutability config at \$CONFIG_FILE"
    echo "Please add --net-connector=\${SERVER},\${BEAST_PORT},beast_reduce_plus_out to your configuration."
  fi
}

echo ""
echo "Detecting feeder software..."
SOFTWARE_TYPE=\$(detect_feeder_software)
echo "Detected: \$SOFTWARE_TYPE"

# Store software type
echo "\$SOFTWARE_TYPE" > "\$INSTALL_DIR/software-type"
chmod 644 "\$INSTALL_DIR/software-type"

echo ""
echo "Configuring Beast feed..."
FEED_CONFIGURED=0

case "\$SOFTWARE_TYPE" in
  ultrafeeder)
    configure_ultrafeeder
    FEED_CONFIGURED=1
    ;;
  piaware)
    configure_piaware
    FEED_CONFIGURED=1
    ;;
  fr24)
    configure_fr24
    FEED_CONFIGURED=1
    ;;
  readsb)
    configure_readsb
    FEED_CONFIGURED=1
    ;;
  dump1090-fa)
    configure_dump1090_fa
    FEED_CONFIGURED=1
    ;;
  dump1090-mutability)
    configure_dump1090_mutability
    FEED_CONFIGURED=1
    ;;
  *)
    echo ""
    echo "Could not auto-detect feeder software."
    echo "Manual configuration options:"
    echo "  For readsb/dump1090: --net-connector=\${SERVER},\${BEAST_PORT},beast_reduce_plus_out"
    echo "  For ultrafeeder: adsb,\${SERVER},\${BEAST_PORT},beast_reduce_plus_out"
    ;;
esac

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
SOFTWARE_TYPE_FILE="/usr/local/share/hangartrak-radar/software-type"
HEARTBEAT_TOKEN=""
SOFTWARE_TYPE="unknown"

# Stats file paths for different feeder software
JSON_PATHS=(
  "/run/readsb"
  "/run/dump1090-fa"
  "/run/dump1090"
  "/run/dump1090-mutability"
  "/opt/adsb/data/readsb"
)

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

# Load software type from file
if [ -f "\$SOFTWARE_TYPE_FILE" ]; then
    SOFTWARE_TYPE=\$(cat "\$SOFTWARE_TYPE_FILE")
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

# Feeder software detection function (for dynamic detection)
detect_feeder_software() {
  # Check for adsb.im / Ultrafeeder (Docker-based)
  if command -v docker &>/dev/null; then
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -qi "ultrafeeder"; then
      echo "ultrafeeder"
      return
    fi
  fi

  # Check for PiAware
  if [ -f "/usr/bin/piaware" ] || systemctl is-active piaware &>/dev/null; then
    echo "piaware"
    return
  fi

  # Check for FR24 feeder
  if systemctl is-active fr24feed &>/dev/null || [ -f "/etc/fr24feed.ini" ]; then
    echo "fr24"
    return
  fi

  # Check for dump1090-mutability
  if [ -f "/usr/bin/dump1090-mutability" ] || [ -f "/etc/default/dump1090-mutability" ]; then
    echo "dump1090-mutability"
    return
  fi

  # Check for dump1090-fa (without piaware)
  if [ -f "/usr/bin/dump1090-fa" ] || [ -f "/etc/default/dump1090-fa" ]; then
    echo "dump1090-fa"
    return
  fi

  # Check for readsb standalone (systemd service, no Docker)
  if systemctl is-active readsb &>/dev/null || [ -f "/etc/default/readsb" ]; then
    echo "readsb"
    return
  fi

  echo "unknown"
}

# Re-detect software type if unknown or file doesn't exist
if [ "\$SOFTWARE_TYPE" = "unknown" ] || [ ! -f "\$SOFTWARE_TYPE_FILE" ]; then
    SOFTWARE_TYPE=\$(detect_feeder_software)
    echo "\$SOFTWARE_TYPE" > "\$SOFTWARE_TYPE_FILE" 2>/dev/null || true
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

echo "Stats Reporter: UUID=\$UUID JSON=\$JSON_DIR SOFTWARE=\$SOFTWARE_TYPE"

STATS_FILE="\${JSON_DIR}/stats.json"
AIRCRAFT_FILE="\${JSON_DIR}/aircraft.json"
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

        # Extract aircraft positions for range calculation (up to 50 aircraft with positions)
        AIRCRAFT_JSON='[]'
        if [ -f "\$AIRCRAFT_FILE" ]; then
            AIRCRAFT_JSON=\$(jq -c '[.aircraft[] | select(.lat != null) | {hex: .hex, lat: .lat, lon: .lon}] | .[0:50]' "\$AIRCRAFT_FILE" 2>/dev/null || echo '[]')
        fi

        PAYLOAD=\$(jq -n \\
            --arg uuid "\$UUID" \\
            --argjson now "\$NOW" \\
            --argjson aircraft_with_pos "\$AIRCRAFT" \\
            --argjson messages "\$MSG_DELTA" \\
            --argjson positions "\$POS_DELTA" \\
            --arg softwareType "\$SOFTWARE_TYPE" \\
            --argjson aircraft "\$AIRCRAFT_JSON" \\
            '{uuid: \$uuid, now: \$now, aircraft_with_pos: \$aircraft_with_pos, messages: \$messages, positions: \$positions, softwareType: \$softwareType, aircraft: \$aircraft}')
    else
        AIRCRAFT=\$(grep -oP '"aircraft_with_pos"\\s*:\\s*\\K\\d+' "\$STATS_FILE" 2>/dev/null || echo "0")
        PAYLOAD="{\"uuid\":\"\$UUID\",\"now\":\$NOW,\"aircraft_with_pos\":\$AIRCRAFT,\"messages\":0,\"positions\":0,\"softwareType\":\"\$SOFTWARE_TYPE\"}"
        MSG_DELTA=0
        POS_DELTA=0
    fi

    RESPONSE=\$(curl -sS -m \$MAX_CURL_TIME -X POST -H "Content-Type: application/json" -H "Authorization: Bearer \$HEARTBEAT_TOKEN" -d "\$PAYLOAD" "\$REMOTE_URL" 2>&1)
    RV=\$?

    if [ \$RV -eq 0 ] && echo "\$RESPONSE" | grep -q '"success":true'; then
        echo "[\$(date -Iseconds)] OK: aircraft=\$AIRCRAFT msgs=\$MSG_DELTA pos=\$POS_DELTA software=\$SOFTWARE_TYPE"
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
After=network.target readsb.service dump1090-fa.service dump1090.service piaware.service

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

# Restart the appropriate service if we configured it
echo ""
case "\$SOFTWARE_TYPE" in
  readsb)
    echo "Restarting readsb..."
    systemctl restart readsb 2>/dev/null || true
    ;;
  piaware|dump1090-fa)
    echo "Restarting dump1090-fa..."
    systemctl restart dump1090-fa 2>/dev/null || true
    ;;
  fr24)
    echo "Restarting dump1090..."
    systemctl restart dump1090 2>/dev/null || true
    ;;
  dump1090-mutability)
    echo "Restarting dump1090-mutability..."
    systemctl restart dump1090-mutability 2>/dev/null || true
    ;;
  ultrafeeder)
    echo ""
    echo "NOTE: Ultrafeeder (Docker) requires manual restart:"
    echo "  cd /opt/adsb && docker compose up -d"
    ;;
esac

echo ""
echo "======================================"
echo "Setup Complete!"
echo "======================================"
echo ""
echo "Detected Software: \$SOFTWARE_TYPE"
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
