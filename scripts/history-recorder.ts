/**
 * History Recorder - Periodically saves aircraft position snapshots.
 *
 * Run with: npx tsx scripts/history-recorder.ts
 *
 * In production, this should be run as a background service alongside the Next.js app.
 * It calls the internal snapshot endpoint every 10 seconds.
 *
 * Environment variables:
 *   APP_URL - Base URL of the Next.js app (default: http://localhost:3000)
 *   INTERNAL_CRON_SECRET - Secret for authenticating internal API calls
 *   SNAPSHOT_INTERVAL_MS - Interval between snapshots in ms (default: 10000)
 */

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const INTERNAL_SECRET = process.env.INTERNAL_CRON_SECRET || "";
const INTERVAL_MS = parseInt(process.env.SNAPSHOT_INTERVAL_MS || "10000");

async function takeSnapshot() {
  try {
    const headers: Record<string, string> = {};
    if (INTERNAL_SECRET) {
      headers.authorization = `Bearer ${INTERNAL_SECRET}`;
    }

    const response = await fetch(
      `${APP_URL}/api/internal/history-snapshot`,
      {
        method: "POST",
        headers,
      }
    );

    if (!response.ok) {
      const body = await response.text();
      console.error(`Snapshot failed (${response.status}): ${body}`);
      return;
    }

    const result = await response.json();
    const time = new Date().toISOString().split("T")[1]?.slice(0, 8);
    console.log(
      `[${time}] Recorded ${result.recorded} aircraft positions`
    );
  } catch (error) {
    console.error("Snapshot error:", error);
  }
}

console.log(`History recorder starting (interval: ${INTERVAL_MS}ms)`);
console.log(`Target: ${APP_URL}/api/internal/history-snapshot`);

// Take initial snapshot
takeSnapshot();

// Schedule recurring snapshots
setInterval(takeSnapshot, INTERVAL_MS);
