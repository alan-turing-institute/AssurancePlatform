-- CreateTable
CREATE TABLE "password_reset_attempts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "successful" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "password_reset_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "event_type" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "password_reset_attempts_email_attempted_at_idx" ON "password_reset_attempts"("email", "attempted_at");

-- CreateIndex
CREATE INDEX "password_reset_attempts_ip_address_attempted_at_idx" ON "password_reset_attempts"("ip_address", "attempted_at");

-- CreateIndex
CREATE INDEX "security_audit_logs_user_id_idx" ON "security_audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "security_audit_logs_event_type_idx" ON "security_audit_logs"("event_type");

-- CreateIndex
CREATE INDEX "security_audit_logs_created_at_idx" ON "security_audit_logs"("created_at");
