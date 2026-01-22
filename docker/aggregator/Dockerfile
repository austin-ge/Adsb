# ADS-B Aggregator: readsb + tar1090
# Receives Beast feeds from Pi feeders and serves live map

FROM debian:bookworm-slim

# Install dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    libncurses-dev \
    zlib1g-dev \
    librtlsdr-dev \
    lighttpd \
    wget \
    ca-certificates \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Build readsb from source (wiedehopf's version)
WORKDIR /tmp
RUN git clone --depth 1 https://github.com/wiedehopf/readsb.git \
    && cd readsb \
    && make RTLSDR=no \
    && cp readsb /usr/local/bin/ \
    && cp viewadsb /usr/local/bin/ \
    && cd .. \
    && rm -rf readsb

# Create directories
RUN mkdir -p /run/readsb /var/www/html/tar1090

# Install tar1090 (web interface)
WORKDIR /opt
RUN git clone --depth 1 https://github.com/wiedehopf/tar1090.git \
    && cp -r tar1090/html/* /var/www/html/tar1090/ \
    && rm -rf tar1090

# Configure tar1090 to read from readsb JSON
RUN echo '{ \
    "tar1090Version": "aggregator", \
    "indexedDB": true, \
    "lastLeg": true \
}' > /var/www/html/tar1090/config.js

# Add data directory symlink for tar1090
RUN ln -sf /run/readsb /var/www/html/tar1090/data

# Configure lighttpd
RUN echo 'server.modules += ("mod_setenv")' >> /etc/lighttpd/lighttpd.conf \
    && echo 'setenv.add-response-header = ("Access-Control-Allow-Origin" => "*")' >> /etc/lighttpd/lighttpd.conf \
    && echo 'server.document-root = "/var/www/html/tar1090"' >> /etc/lighttpd/lighttpd.conf \
    && echo 'server.port = 80' >> /etc/lighttpd/lighttpd.conf \
    && echo 'index-file.names = ("index.html")' >> /etc/lighttpd/lighttpd.conf \
    && echo 'mimetype.assign = (' >> /etc/lighttpd/lighttpd.conf \
    && echo '  ".html" => "text/html",' >> /etc/lighttpd/lighttpd.conf \
    && echo '  ".js" => "application/javascript",' >> /etc/lighttpd/lighttpd.conf \
    && echo '  ".css" => "text/css",' >> /etc/lighttpd/lighttpd.conf \
    && echo '  ".json" => "application/json",' >> /etc/lighttpd/lighttpd.conf \
    && echo '  ".png" => "image/png",' >> /etc/lighttpd/lighttpd.conf \
    && echo '  ".svg" => "image/svg+xml"' >> /etc/lighttpd/lighttpd.conf \
    && echo ')' >> /etc/lighttpd/lighttpd.conf

# Copy startup script
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Expose ports
# 30004: Beast input (feeders connect here)
# 80: tar1090 web interface
EXPOSE 30004 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD pgrep readsb && pgrep lighttpd || exit 1

CMD ["/start.sh"]
