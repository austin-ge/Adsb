// Rate limiter with Upstash Redis for production, in-memory fallback for development
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

// Check if Upstash Redis is configured
const isUpstashConfigured = !!(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

// Initialize Upstash Redis client if configured
const redis = isUpstashConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Create rate limiters for each tier using Upstash sliding window
// We create them lazily based on the limit value
const upstashLimiters = new Map<number, Ratelimit>();

function getUpstashLimiter(limit: number): Ratelimit {
  let limiter = upstashLimiters.get(limit);
  if (!limiter && redis) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, "1 m"),
      prefix: `hangartrak:ratelimit:${limit}`,
    });
    upstashLimiters.set(limit, limiter);
  }
  return limiter!;
}

// In-memory fallback for local development
interface InMemoryRateLimitEntry {
  count: number;
  resetAt: number;
}

const inMemoryStore = new Map<string, InMemoryRateLimitEntry>();

// Clean up old entries every minute (only active when using in-memory)
if (!isUpstashConfigured) {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of inMemoryStore.entries()) {
      if (entry.resetAt < now) {
        inMemoryStore.delete(key);
      }
    }
  }, 60000);
}

function checkRateLimitInMemory(
  identifier: string,
  limit: number
): RateLimitResult {
  const now = Date.now();
  const windowMs = 60000; // 1 minute window

  let entry = inMemoryStore.get(identifier);

  // If no entry or window expired, create new entry
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 1,
      resetAt: now + windowMs,
    };
    inMemoryStore.set(identifier, entry);

    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: entry.resetAt,
    };
  }

  // Check if over limit
  if (entry.count >= limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      reset: entry.resetAt,
    };
  }

  // Increment count
  entry.count++;
  inMemoryStore.set(identifier, entry);

  return {
    success: true,
    limit,
    remaining: limit - entry.count,
    reset: entry.resetAt,
  };
}

/**
 * Check rate limit for an identifier (API key or IP address)
 * Uses Upstash Redis in production, falls back to in-memory for local dev
 */
export async function checkRateLimit(
  identifier: string,
  limit: number
): Promise<RateLimitResult> {
  // Use in-memory fallback if Upstash is not configured
  if (!isUpstashConfigured || !redis) {
    return checkRateLimitInMemory(identifier, limit);
  }

  try {
    const limiter = getUpstashLimiter(limit);
    const result = await limiter.limit(identifier);

    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      // Upstash returns reset as Unix timestamp in milliseconds
      reset: result.reset,
    };
  } catch (error) {
    // If Upstash fails, fall back to in-memory to avoid blocking requests
    console.error("Upstash rate limit error, falling back to in-memory:", error);
    return checkRateLimitInMemory(identifier, limit);
  }
}
