import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  user: {
    additionalFields: {
      apiKeyHash: {
        type: "string",
        required: false,
      },
      apiKeyPrefix: {
        type: "string",
        required: false,
      },
      apiTier: {
        type: "string",
        required: false,
        defaultValue: "FREE",
      },
    },
  },
  trustedOrigins: [process.env.BETTER_AUTH_URL].filter(Boolean) as string[],
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 10,
  },
});

// Export type for client
export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
