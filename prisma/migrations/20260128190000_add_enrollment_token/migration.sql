-- AlterTable
ALTER TABLE "Feeder" ADD COLUMN     "enrollmentExpires" TIMESTAMP(3),
ADD COLUMN     "enrollmentToken" TEXT,
ALTER COLUMN "heartbeatToken" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Feeder_enrollmentToken_key" ON "Feeder"("enrollmentToken");
