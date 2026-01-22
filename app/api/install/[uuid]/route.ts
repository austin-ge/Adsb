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
    select: { id: true, name: true, uuid: true },
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

  // Get the server URL from environment or request
  const serverUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const serverHost = new URL(serverUrl).hostname;
  const beastPort = process.env.BEAST_PORT || "30004";

  const script = `#!/bin/bash
# ADS-B Aggregator Feeder Setup Script
# Feeder: ${feeder.name}
# UUID: ${feeder.uuid}
#
# This script configures your Raspberry Pi to feed ADS-B data to our network.
# Run with: curl -sSL ${serverUrl}/api/install/${feeder.uuid} | sudo bash

set -e

FEEDER_UUID="${feeder.uuid}"
SERVER="${serverHost}"
PORT="${beastPort}"
READSB_CONFIG="/etc/default/readsb"
ULTRAFEEDER_CONFIG="/opt/adsb/config/ultrafeeder/.env"

echo "======================================"
echo "ADS-B Aggregator - Feeder Setup"
echo "======================================"
echo ""
echo "Feeder Name: ${feeder.name}"
echo "Feeder UUID: \${FEEDER_UUID}"
echo "Server: \${SERVER}:\${PORT}"
echo ""

# Check if running as root
if [ "\$EUID" -ne 0 ]; then
  echo "Error: This script must be run as root (sudo)"
  exit 1
fi

# Function to detect and configure readsb
configure_readsb() {
  if [ -f "\$READSB_CONFIG" ]; then
    echo "Found readsb configuration at \$READSB_CONFIG"

    # Check if already configured
    if grep -q "\${SERVER}" "\$READSB_CONFIG" 2>/dev/null; then
      echo "Already configured to feed to \${SERVER}"
      return 0
    fi

    # Add net-connector to READSB_NET_OPTIONS
    if grep -q "READSB_NET_OPTIONS" "\$READSB_CONFIG"; then
      # Append to existing options
      sed -i "s|READSB_NET_OPTIONS=\"\\(.*\\)\"|READSB_NET_OPTIONS=\"\\1 --net-connector=\${SERVER},\${PORT},beast_reduce_plus_out,\${FEEDER_UUID}\"|" "\$READSB_CONFIG"
    else
      # Add new line
      echo "READSB_NET_OPTIONS=\"--net-connector=\${SERVER},\${PORT},beast_reduce_plus_out,\${FEEDER_UUID}\"" >> "\$READSB_CONFIG"
    fi

    echo "Configuration updated. Restarting readsb..."
    systemctl restart readsb
    echo "readsb restarted successfully!"
    return 0
  fi
  return 1
}

# Function to configure ultrafeeder (Docker-based)
configure_ultrafeeder() {
  if [ -f "\$ULTRAFEEDER_CONFIG" ]; then
    echo "Found ultrafeeder configuration at \$ULTRAFEEDER_CONFIG"

    # Check if already configured
    if grep -q "\${SERVER}" "\$ULTRAFEEDER_CONFIG" 2>/dev/null; then
      echo "Already configured to feed to \${SERVER}"
      return 0
    fi

    # Add to ULTRAFEEDER_CONFIG
    if grep -q "ULTRAFEEDER_CONFIG=" "\$ULTRAFEEDER_CONFIG"; then
      # Append to existing config
      sed -i "s|ULTRAFEEDER_CONFIG=\"\\(.*\\)\"|ULTRAFEEDER_CONFIG=\"\\1;adsb,\${SERVER},\${PORT},beast_reduce_plus_out,\${FEEDER_UUID}\"|" "\$ULTRAFEEDER_CONFIG"
    else
      echo "ULTRAFEEDER_CONFIG=\"adsb,\${SERVER},\${PORT},beast_reduce_plus_out,\${FEEDER_UUID}\"" >> "\$ULTRAFEEDER_CONFIG"
    fi

    echo "Configuration updated. Please restart your ultrafeeder container:"
    echo "  docker compose restart ultrafeeder"
    return 0
  fi
  return 1
}

# Try to configure
echo "Detecting ADS-B receiver software..."
echo ""

if configure_readsb; then
  echo ""
  echo "======================================"
  echo "Setup Complete!"
  echo "======================================"
  echo ""
  echo "Your feeder is now configured to send data to our network."
  echo "View your stats at: ${serverUrl}/feeders/\${FEEDER_UUID}"
  echo ""
  exit 0
fi

if configure_ultrafeeder; then
  echo ""
  echo "======================================"
  echo "Setup Complete!"
  echo "======================================"
  echo ""
  echo "Your feeder is now configured to send data to our network."
  echo "Don't forget to restart your ultrafeeder container!"
  echo "View your stats at: ${serverUrl}/feeders/\${FEEDER_UUID}"
  echo ""
  exit 0
fi

# Manual configuration instructions
echo "Could not automatically detect your ADS-B receiver software."
echo ""
echo "======================================"
echo "Manual Configuration"
echo "======================================"
echo ""
echo "For readsb, add this to your configuration:"
echo "  --net-connector=\${SERVER},\${PORT},beast_reduce_plus_out,\${FEEDER_UUID}"
echo ""
echo "For ultrafeeder/tar1090, add this to ULTRAFEEDER_CONFIG:"
echo "  adsb,\${SERVER},\${PORT},beast_reduce_plus_out,\${FEEDER_UUID}"
echo ""
echo "For other software, configure Beast output to:"
echo "  Host: \${SERVER}"
echo "  Port: \${PORT}"
echo "  Protocol: Beast"
echo "  UUID: \${FEEDER_UUID}"
echo ""
echo "After configuring, view your stats at:"
echo "  ${serverUrl}/feeders/\${FEEDER_UUID}"
echo ""

exit 0
`;

  return new NextResponse(script, {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "Content-Disposition": `attachment; filename="install-${feeder.uuid}.sh"`,
    },
  });
}
