import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

/**
 * Test endpoint for verifying Sentry error tracking
 * Only available in development or when explicitly enabled
 *
 * GET /api/sentry-test - Trigger a test error
 */
export async function GET(): Promise<NextResponse> {
  // Only allow in development or if explicitly enabled
  if (
    process.env.NODE_ENV === "production" &&
    process.env.SENTRY_TEST_ENABLED !== "true"
  ) {
    return NextResponse.json(
      { error: "Test endpoint disabled in production" },
      { status: 403 }
    );
  }

  // Set some test context
  Sentry.setUser({
    id: "test-user-id",
    email: "test@example.com",
  });

  Sentry.setTag("test.type", "manual");
  Sentry.setContext("test_context", {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });

  // Add a breadcrumb
  Sentry.addBreadcrumb({
    category: "test",
    message: "Test error triggered via /api/sentry-test",
    level: "info",
  });

  // Capture the test error
  const testError = new Error("Sentry test error - this is intentional");
  const eventId = Sentry.captureException(testError);

  // Flush to ensure the error is sent before responding
  await Sentry.flush(2000);

  return NextResponse.json({
    success: true,
    message: "Test error sent to Sentry",
    eventId,
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN ? "configured" : "not configured",
  });
}
