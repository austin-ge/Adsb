#!/bin/sh
set -e

echo "Starting HangarTrak Radar Workers with PM2..."

# Optional: Run migrations if WORKER_RUN_MIGRATIONS=true
# By default, skip migrations (main app handles them)
if [ "${WORKER_RUN_MIGRATIONS}" = "true" ]; then
    echo "Running database migrations..."
    npx prisma migrate deploy
fi

echo "Launching all workers via PM2..."
echo "Workers:"
echo "  - stats-worker (continuous)"
echo "  - history-recorder (continuous)"
echo "  - history-cleanup (hourly cron)"
echo "  - flight-segmenter (every 5 min cron)"

exec pm2-runtime ecosystem.config.js
