// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
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

  // Filter out expected errors
  beforeSend(event, hint) {
    const error = hint.originalException;

    // Ignore expected HTTP errors
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Ignore auth-related errors (expected)
      if (
        message.includes("unauthorized") ||
        message.includes("forbidden") ||
        message.includes("401") ||
        message.includes("403")
      ) {
        return null;
      }

      // Ignore rate limiting (expected)
      if (message.includes("rate limit") || message.includes("429")) {
        return null;
      }

      // Ignore client disconnections
      if (
        message.includes("client disconnected") ||
        message.includes("aborted")
      ) {
        return null;
      }
    }

    return event;
  },

  // Spotlight is useful for development
  spotlight: process.env.NODE_ENV === "development",
});
