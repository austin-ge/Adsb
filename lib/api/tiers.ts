import { ApiTier } from "@prisma/client";

export const TIER_LIMITS: Record<ApiTier, number> = {
  FREE: 100, // 100 requests per minute
  FEEDER: 1000, // 1000 requests per minute
  PRO: 10000, // 10000 requests per minute
};

export function getTierLimit(tier: ApiTier): number {
  return TIER_LIMITS[tier] || TIER_LIMITS.FREE;
}
