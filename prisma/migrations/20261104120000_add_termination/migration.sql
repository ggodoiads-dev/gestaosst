-- CreateTable
CREATE TABLE IF NOT EXISTS "Termination" (
    "id" TEXT NOT NULL,
    "dedupKey" TEXT NOT NULL,
    "collaboratorId" TEXT,
    "name" TEXT NOT NULL,
    "matricula" TEXT,
    "cargo" TEXT,
    "areaName" TEXT,
    "turnoName" TEXT,
    "admissionDate" TIMESTAMP(3),
    "terminationDate" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "importedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Termination_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Termination_dedupKey_key" ON "Termination"("dedupKey");
CREATE INDEX IF NOT EXISTS "Termination_terminationDate_idx" ON "Termination"("terminationDate");
CREATE INDEX IF NOT EXISTS "Termination_collaboratorId_idx" ON "Termination"("collaboratorId");
