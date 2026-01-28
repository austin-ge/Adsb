import * as Sentry from "@sentry/nextjs";

/**
 * Set user context for Sentry error tracking
 * Call this after authentication to include user info in error reports
 */
export function setSentryUser(user: {
  id: string;
  email?: string | null;
} | null): void {
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email ?? undefined,
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Set feeder context for Sentry error tracking
 * Call this when processing feeder-related requests
 */
export function setSentryFeederContext(feeder: {
  id: string;
  uuid: string;
  name?: string | null;
} | null): void {
  if (feeder) {
    Sentry.setTag("feeder.id", feeder.id);
    Sentry.setTag("feeder.uuid", feeder.uuid);
    if (feeder.name) {
      Sentry.setTag("feeder.name", feeder.name);
    }
    Sentry.setContext("feeder", {
      id: feeder.id,
      uuid: feeder.uuid,
      name: feeder.name,
    });
  } else {
    Sentry.setTag("feeder.id", undefined);
    Sentry.setTag("feeder.uuid", undefined);
    Sentry.setTag("feeder.name", undefined);
    Sentry.setContext("feeder", null);
  }
}

/**
 * Capture an exception with additional context
 */
export function captureException(
  error: Error | unknown,
  context?: {
    extra?: Record<string, unknown>;
    tags?: Record<string, string>;
    level?: Sentry.SeverityLevel;
  }
): string {
  return Sentry.captureException(error, {
    extra: context?.extra,
    tags: context?.tags,
    level: context?.level,
  });
}

/**
 * Capture a message (non-error event)
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = "info"
): string {
  return Sentry.captureMessage(message, level);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
  Sentry.addBreadcrumb(breadcrumb);
}

/**
 * Start a transaction for performance monitoring
 */
export function startSpan<T>(
  options: {
    name: string;
    op?: string;
    attributes?: Record<string, string | number | boolean>;
  },
  callback: () => T
): T {
  return Sentry.startSpan(options, callback);
}
