-- CreateTable
CREATE TABLE "Flight" (
    "id" TEXT NOT NULL,
    "hex" TEXT NOT NULL,
    "callsign" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "maxAltitude" INTEGER,
    "totalDistance" DOUBLE PRECISION,
    "durationSecs" INTEGER NOT NULL,
    "positionCount" INTEGER NOT NULL,
    "startLat" DOUBLE PRECISION NOT NULL,
    "startLon" DOUBLE PRECISION NOT NULL,
    "endLat" DOUBLE PRECISION NOT NULL,
    "endLon" DOUBLE PRECISION NOT NULL,
    "positions" JSONB NOT NULL,
    "segmentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Flight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Flight_hex_idx" ON "Flight"("hex");

-- CreateIndex
CREATE INDEX "Flight_callsign_idx" ON "Flight"("callsign");

-- CreateIndex
CREATE INDEX "Flight_startTime_idx" ON "Flight"("startTime");

-- CreateIndex
CREATE INDEX "Flight_hex_startTime_idx" ON "Flight"("hex", "startTime");

-- CreateIndex
CREATE INDEX "AircraftPosition_flight_timestamp_idx" ON "AircraftPosition"("flight", "timestamp");
