-- CreateTable
CREATE TABLE "rate_limit_attempts" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "identifier_type" TEXT NOT NULL,
    "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,

    CONSTRAINT "rate_limit_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rate_limit_attempts_endpoint_identifier_attempted_at_idx" ON "rate_limit_attempts"("endpoint", "identifier", "attempted_at");

-- CreateIndex
CREATE INDEX "rate_limit_attempts_endpoint_identifier_type_attempted_at_idx" ON "rate_limit_attempts"("endpoint", "identifier_type", "attempted_at");

-- CreateIndex
CREATE INDEX "rate_limit_attempts_attempted_at_idx" ON "rate_limit_attempts"("attempted_at");
