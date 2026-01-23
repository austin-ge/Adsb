import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, RateLimitResult } from "./rate-limit";
import { getTierLimit } from "./tiers";
import { ApiTier } from "@prisma/client";

export interface ApiUser {
  id: string;
  email: string;
  apiTier: ApiTier;
}

export interface ApiContext {
  user: ApiUser | null;
  rateLimit: RateLimitResult;
}

/**
 * Validate API key and check rate limits
 * Returns null if validation fails (response already sent)
 */
export async function validateApiRequest(
  request: NextRequest
): Promise<{ context: ApiContext; response?: NextResponse } | null> {
  const apiKey = request.headers.get("x-api-key");

  let user: ApiUser | null = null;
  let tier: ApiTier = ApiTier.FREE;

  // If API key provided, validate it (hash first, then lookup)
  if (apiKey) {
    const apiKeyHash = createHash("sha256").update(apiKey).digest("hex");
    const dbUser = await prisma.user.findUnique({
      where: { apiKeyHash },
      select: { id: true, email: true, apiTier: true },
    });

    if (!dbUser) {
      return {
        context: { user: null, rateLimit: { success: false, limit: 0, remaining: 0, reset: 0 } },
        response: NextResponse.json(
          { error: "Invalid API key" },
          { status: 401 }
        ),
      };
    }

    user = dbUser;
    tier = dbUser.apiTier;
  }

  // Rate limit based on API key or IP
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const clientIp = forwardedFor?.split(",")[0]?.trim() || realIp || "anonymous";
  const identifier = apiKey || clientIp;
  const limit = getTierLimit(tier);
  const rateLimit = checkRateLimit(identifier, limit);

  // Add rate limit headers
  const headers = new Headers();
  headers.set("X-RateLimit-Limit", String(rateLimit.limit));
  headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
  headers.set("X-RateLimit-Reset", String(rateLimit.reset));

  if (!rateLimit.success) {
    return {
      context: { user, rateLimit },
      response: NextResponse.json(
        {
          error: "Rate limit exceeded",
          limit: rateLimit.limit,
          reset: new Date(rateLimit.reset).toISOString(),
        },
        { status: 429, headers }
      ),
    };
  }

  return {
    context: { user, rateLimit },
  };
}

/**
 * Require authentication for an endpoint
 */
export function requireAuth(context: ApiContext): NextResponse | null {
  if (!context.user) {
    return NextResponse.json(
      { error: "Authentication required. Provide API key via x-api-key header." },
      { status: 401 }
    );
  }
  return null;
}

/**
 * Require FEEDER or PRO tier for an endpoint
 */
export function requireFeederTier(context: ApiContext): NextResponse | null {
  if (!context.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  if (context.user.apiTier === ApiTier.FREE) {
    return NextResponse.json(
      { error: "This endpoint requires FEEDER or PRO tier. Start feeding to get free access!" },
      { status: 403 }
    );
  }

  return null;
}
