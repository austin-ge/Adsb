-- CreateTable
CREATE TABLE "AircraftPosition" (
    "id" TEXT NOT NULL,
    "hex" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "altitude" INTEGER,
    "heading" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "squawk" TEXT,
    "flight" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AircraftPosition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AircraftPosition_timestamp_idx" ON "AircraftPosition"("timestamp");

-- CreateIndex
CREATE INDEX "AircraftPosition_hex_timestamp_idx" ON "AircraftPosition"("hex", "timestamp");

-- CreateIndex
CREATE INDEX "AircraftPosition_timestamp_hex_idx" ON "AircraftPosition"("timestamp", "hex");
