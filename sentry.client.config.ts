// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 0.1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Replay configuration for session replays (optional, resource-intensive)
  replaysOnErrorSampleRate: 0.1,
  replaysSessionSampleRate: 0,

  integrations: [
    Sentry.replayIntegration({
      // Mask all text content for privacy
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Filter out expected errors
  beforeSend(event, hint) {
    const error = hint.originalException;

    // Ignore 401/403 errors (expected auth failures)
    if (error instanceof Error) {
      if (
        error.message.includes("401") ||
        error.message.includes("Unauthorized") ||
        error.message.includes("403") ||
        error.message.includes("Forbidden")
      ) {
        return null;
      }
    }

    // Ignore network errors that are expected during navigation
    if (
      event.exception?.values?.some(
        (e) =>
          e.type === "TypeError" &&
          e.value?.includes("Failed to fetch")
      )
    ) {
      return null;
    }

    return event;
  },

  // Filter out noisy breadcrumbs
  beforeBreadcrumb(breadcrumb) {
    // Filter out XHR breadcrumbs for polling endpoints
    if (
      breadcrumb.category === "xhr" &&
      breadcrumb.data?.url?.includes("/api/map/aircraft")
    ) {
      return null;
    }
    return breadcrumb;
  },
});
