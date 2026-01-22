# HangarTrak Radar: readsb + tar1090
# Uses sdr-enthusiasts base images for reliability
# Receives Beast feeds from Pi feeders and serves live map

FROM ghcr.io/sdr-enthusiasts/docker-tar1090:latest

# Configuration for aggregator mode
ENV READSB_NET_ONLY="true"
ENV READSB_NET_BEAST_INPUT_PORT="30004"
ENV READSB_JSON_DIR="/run/readsb"
ENV READSB_JSON_INTERVAL="1"
ENV READSB_FORWARD_MLAT="true"

# Enable tar1090 web interface
ENV TAR1090_ENABLE="true"
ENV TAR1090_DEFAULTCENTERLAT="39.8283"
ENV TAR1090_DEFAULTCENTERLON="-98.5795"
ENV TAR1090_DEFAULTZOOMLVL="5"
ENV TAR1090_TITLE="HangarTrak Radar"

# Expose ports
# 30004: Beast input (feeders connect here)
# 80: tar1090 web interface
EXPOSE 30004 80
