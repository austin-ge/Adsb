import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { mockPrisma, resetMocks } from "../mocks/prisma";

// Mock Prisma before importing the route handler
vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

// Import the route handler after mocking
import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("returns status ok when database is connected", async () => {
    // Mock successful database query
    mockPrisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(200);
    expect(data).toEqual({
      status: "ok",
      db: "connected",
    });
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("returns status error when database is disconnected", async () => {
    // Mock database connection failure
    mockPrisma.$queryRaw.mockRejectedValue(new Error("Connection refused"));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      status: "error",
      db: "disconnected",
      error: "Connection refused",
    });
  });

  it("handles unknown database errors gracefully", async () => {
    // Mock non-Error rejection
    mockPrisma.$queryRaw.mockRejectedValue("Something went wrong");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.status).toBe("error");
    expect(data.db).toBe("disconnected");
    expect(data.error).toBe("Unknown database error");
  });
});
