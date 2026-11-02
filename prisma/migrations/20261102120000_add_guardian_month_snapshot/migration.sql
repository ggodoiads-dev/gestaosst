-- CreateTable
CREATE TABLE IF NOT EXISTS "GuardianMonthSnapshot" (
    "month" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuardianMonthSnapshot_pkey" PRIMARY KEY ("month")
);
