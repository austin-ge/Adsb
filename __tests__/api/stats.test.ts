import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockPrisma, resetMocks } from "../mocks/prisma";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

// Mock rate limiting to always succeed
vi.mock("@/lib/api/rate-limit", () => ({
  checkRateLimit: vi.fn(() =>
    Promise.resolve({
      success: true,
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60000,
    })
  ),
}));

// Mock Sentry
vi.mock("@/lib/sentry", () => ({
  setSentryUser: vi.fn(),
}));

// Mock fetchAircraftData to return predictable data
vi.mock("@/lib/readsb", () => ({
  fetchAircraftData: vi.fn().mockResolvedValue({
    now: 1706400000,
    messages: 12345,
    aircraft: [
      { hex: "abc123", lat: 40.7128, lon: -74.006 },
      { hex: "def456", lat: 34.0522, lon: -118.2437 },
      { hex: "ghi789" }, // No position
    ],
  }),
}));

// Import the route handler after mocking
import { GET } from "@/app/api/v1/stats/route";

describe("GET /api/v1/stats", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("returns network statistics without API key (anonymous)", async () => {
    // Mock database responses
    mockPrisma.feeder.count.mockResolvedValueOnce(10); // total feeders
    mockPrisma.feeder.count.mockResolvedValueOnce(5); // online feeders
    mockPrisma.feeder.aggregate.mockResolvedValue({
      _sum: {
        messagesTotal: BigInt(1000000),
        positionsTotal: BigInt(500000),
        aircraftSeen: 1500,
      },
    });

    const request = new NextRequest("http://localhost:3000/api/v1/stats");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("network");
    expect(data).toHaveProperty("live");

    // Check network stats
    expect(data.network.feeders.total).toBe(10);
    expect(data.network.feeders.online).toBe(5);
    expect(data.network.messages_total).toBe("1000000");
    expect(data.network.positions_total).toBe("500000");
    expect(data.network.aircraft_tracked).toBe(1500);

    // Check live stats (from mocked readsb)
    expect(data.live.aircraft).toBe(3);
    expect(data.live.aircraft_with_position).toBe(2);
    expect(data.live.message_rate).toBe(12345);
  });

  it("includes rate limit headers in response", async () => {
    mockPrisma.feeder.count.mockResolvedValue(0);
    mockPrisma.feeder.aggregate.mockResolvedValue({
      _sum: {
        messagesTotal: BigInt(0),
        positionsTotal: BigInt(0),
        aircraftSeen: 0,
      },
    });

    const request = new NextRequest("http://localhost:3000/api/v1/stats");
    const response = await GET(request);

    expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
    expect(response.headers.has("X-RateLimit-Reset")).toBe(true);
  });

  it("returns 401 for invalid API key", async () => {
    // Mock invalid API key lookup
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/v1/stats", {
      headers: {
        "x-api-key": "invalid-key",
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Invalid API key");
  });

  it("handles database errors gracefully", async () => {
    mockPrisma.feeder.count.mockRejectedValue(new Error("Database error"));

    const request = new NextRequest("http://localhost:3000/api/v1/stats");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });

  it("handles zero feeders correctly", async () => {
    mockPrisma.feeder.count.mockResolvedValue(0);
    mockPrisma.feeder.aggregate.mockResolvedValue({
      _sum: {
        messagesTotal: null,
        positionsTotal: null,
        aircraftSeen: null,
      },
    });

    const request = new NextRequest("http://localhost:3000/api/v1/stats");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.network.feeders.total).toBe(0);
    expect(data.network.feeders.online).toBe(0);
    expect(data.network.messages_total).toBe("0");
    expect(data.network.positions_total).toBe("0");
    expect(data.network.aircraft_tracked).toBe(0);
  });
});
