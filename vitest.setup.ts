import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock Next.js headers
vi.mock("next/headers", () => ({
  headers: () => new Map(),
  cookies: () => ({
    get: () => undefined,
    set: () => {},
    delete: () => {},
  }),
}));

// Mock environment variables for tests
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.READSB_JSON_URL = "http://localhost:8080/data/aircraft.json";
