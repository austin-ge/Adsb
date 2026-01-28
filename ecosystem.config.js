/**
 * PM2 Ecosystem Configuration for HangarTrak Radar Workers
 *
 * This file configures all background workers to run with PM2.
 *
 * Workers:
 * - stats-worker: Continuous process (1 min poll interval internally)
 * - history-recorder: Continuous process (10s interval internally)
 * - history-cleanup: Runs every hour via cron_restart
 * - flight-segmenter: Runs every 5 minutes via cron_restart
 *
 * Usage:
 *   Production: pm2-runtime ecosystem.config.js
 *   Development: pm2 start ecosystem.config.js
 *   Status: pm2 status
 *   Logs: pm2 logs
 */

module.exports = {
  apps: [
    {
      name: "stats-worker",
      script: "npx",
      args: "tsx scripts/stats-worker.ts",
      interpreter: "none",
      autorestart: true,
      watch: false,
      max_memory_restart: "256M",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "history-recorder",
      script: "npx",
      args: "tsx scripts/history-recorder.ts",
      interpreter: "none",
      autorestart: true,
      watch: false,
      max_memory_restart: "256M",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "history-cleanup",
      script: "npx",
      args: "tsx scripts/history-cleanup.ts",
      interpreter: "none",
      autorestart: false,
      watch: false,
      cron_restart: "0 * * * *", // Every hour at minute 0
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "flight-segmenter",
      script: "npx",
      args: "tsx scripts/flight-segmenter.ts",
      interpreter: "none",
      autorestart: false,
      watch: false,
      cron_restart: "*/5 * * * *", // Every 5 minutes
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
