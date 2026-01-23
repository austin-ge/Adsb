-- DropIndex
DROP INDEX IF EXISTS "user_apiKey_key";

-- AlterTable: user - drop apiKey, add apiKeyHash and apiKeyPrefix
ALTER TABLE "user" DROP COLUMN IF EXISTS "apiKey";
ALTER TABLE "user" ADD COLUMN "apiKeyHash" TEXT;
ALTER TABLE "user" ADD COLUMN "apiKeyPrefix" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "user_apiKeyHash_key" ON "user"("apiKeyHash");

-- AlterTable: Feeder - add heartbeatToken
ALTER TABLE "Feeder" ADD COLUMN "heartbeatToken" TEXT;

-- Set a default heartbeatToken for existing feeders
UPDATE "Feeder" SET "heartbeatToken" = gen_random_uuid()::text WHERE "heartbeatToken" IS NULL;

-- Now make it required and unique
ALTER TABLE "Feeder" ALTER COLUMN "heartbeatToken" SET NOT NULL;
CREATE UNIQUE INDEX "Feeder_heartbeatToken_key" ON "Feeder"("heartbeatToken");
