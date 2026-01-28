import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { randomBytes, timingSafeEqual } from "crypto";

interface RouteParams {
  params: Promise<{ uuid: string }>;
}

// POST /api/v1/feeders/:uuid/enroll
// Exchanges a short-lived enrollment token for a permanent heartbeat token
// This is called once during initial feeder setup
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { uuid } = await params;

  // Validate UUID format
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(uuid)) {
    return NextResponse.json({ error: "Invalid UUID format" }, { status: 400 });
  }

  // Rate limit: 5 enrollment attempts per minute per UUID
  // This is stricter than heartbeat since enrollment should only happen once
  const rateLimit = await checkRateLimit(`enroll:${uuid}`, 5);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded", reset: new Date(rateLimit.reset).toISOString() },
      { status: 429 }
    );
  }

  // Validate enrollment token from Authorization header
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid Authorization header" },
      { status: 401 }
    );
  }
  const token = authHeader.slice(7);

  // Validate token format (should be 64 hex chars = 32 bytes)
  if (!/^[0-9a-f]{64}$/i.test(token)) {
    return NextResponse.json(
      { error: "Invalid token format" },
      { status: 400 }
    );
  }

  // Find the feeder
  const feeder = await prisma.feeder.findUnique({
    where: { uuid },
    select: {
      id: true,
      uuid: true,
      name: true,
      enrollmentToken: true,
      enrollmentExpires: true,
      heartbeatToken: true,
    },
  });

  if (!feeder) {
    return NextResponse.json({ error: "Feeder not found" }, { status: 404 });
  }

  // Check if already enrolled (has heartbeat token)
  if (feeder.heartbeatToken) {
    return NextResponse.json(
      { error: "Feeder already enrolled. Use the heartbeat endpoint with your existing token." },
      { status: 409 }
    );
  }

  // Check if enrollment token exists
  if (!feeder.enrollmentToken) {
    return NextResponse.json(
      { error: "No enrollment token found. Please regenerate the install script." },
      { status: 400 }
    );
  }

  // Check if enrollment token has expired
  if (!feeder.enrollmentExpires || new Date() > feeder.enrollmentExpires) {
    return NextResponse.json(
      { error: "Enrollment token has expired. Please regenerate the install script." },
      { status: 410 }
    );
  }

  // Verify enrollment token using timing-safe comparison
  const tokenBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(feeder.enrollmentToken);
  if (
    tokenBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(tokenBuffer, expectedBuffer)
  ) {
    return NextResponse.json(
      { error: "Invalid enrollment token" },
      { status: 403 }
    );
  }

  // Generate permanent heartbeat token and clear enrollment token
  const heartbeatToken = randomBytes(32).toString("hex");

  try {
    await prisma.feeder.update({
      where: { id: feeder.id },
      data: {
        heartbeatToken,
        enrollmentToken: null,
        enrollmentExpires: null,
      },
    });

    return NextResponse.json({
      success: true,
      heartbeatToken,
      message: "Enrollment successful. Store this token securely - it cannot be retrieved again.",
    });
  } catch (error) {
    console.error("Error enrolling feeder:", error);
    return NextResponse.json(
      { error: "Failed to complete enrollment" },
      { status: 500 }
    );
  }
}
