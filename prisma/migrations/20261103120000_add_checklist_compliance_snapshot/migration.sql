-- CreateTable
CREATE TABLE IF NOT EXISTS "ChecklistComplianceSnapshot" (
    "month" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChecklistComplianceSnapshot_pkey" PRIMARY KEY ("month")
);
