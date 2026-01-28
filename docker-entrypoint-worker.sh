#!/bin/sh
set -e

echo "Starting HangarTrak Radar Stats Worker..."

# Optional: Run migrations if WORKER_RUN_MIGRATIONS=true
# By default, skip migrations (main app handles them)
if [ "${WORKER_RUN_MIGRATIONS}" = "true" ]; then
    echo "Running database migrations..."
    npx prisma migrate deploy
fi

echo "Launching stats worker..."
exec npx tsx scripts/stats-worker.ts
