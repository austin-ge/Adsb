import { vi } from "vitest";

/**
 * Mock PrismaClient for testing without a real database connection.
 *
 * Usage in tests:
 *   import { mockPrisma, resetMocks } from "@/__tests__/mocks/prisma";
 *
 *   vi.mock("@/lib/prisma", () => ({
 *     prisma: mockPrisma,
 *   }));
 *
 *   beforeEach(() => {
 *     resetMocks();
 *   });
 */

export const mockPrisma = {
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),

  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  },

  feeder: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  },

  feederStats: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  },

  aircraftPosition: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  },

  flight: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  },

  session: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },

  account: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },

  verification: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
};

/**
 * Reset all mock functions to their initial state.
 * Call this in beforeEach to ensure clean state between tests.
 */
export function resetMocks(): void {
  vi.clearAllMocks();
}
