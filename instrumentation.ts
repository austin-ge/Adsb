// Instrumentation file for Next.js
// This runs once when the server starts
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Server-side Sentry initialization
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    // Edge runtime Sentry initialization
    await import("./sentry.edge.config");
  }
}

export const onRequestError = async (
  err: Error,
  request: {
    path: string;
    method: string;
    headers: Record<string, string>;
  },
  context: {
    routerKind: "Pages Router" | "App Router";
    routePath: string;
    routeType: "render" | "route" | "action" | "middleware";
    renderSource?: "react-server-components" | "react-server-components-payload" | "server-rendering";
    revalidateReason?: "on-demand" | "stale" | undefined;
    renderType?: "dynamic" | "dynamic-resume";
  }
) => {
  // Dynamically import Sentry to capture errors
  const Sentry = await import("@sentry/nextjs");

  Sentry.captureException(err, {
    extra: {
      path: request.path,
      method: request.method,
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
    },
    tags: {
      "route.path": context.routePath,
      "route.type": context.routeType,
      "router.kind": context.routerKind,
    },
  });
};
