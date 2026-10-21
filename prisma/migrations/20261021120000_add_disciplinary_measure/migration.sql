-- CreateTable
CREATE TABLE IF NOT EXISTS "DisciplinaryMeasure" (
    "id" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "referenceDate" TIMESTAMP(3) NOT NULL,
    "step" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "decidedById" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DisciplinaryMeasure_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DisciplinaryMeasure_collaboratorId_reason_referenceDate_key" ON "DisciplinaryMeasure"("collaboratorId", "reason", "referenceDate");
CREATE INDEX IF NOT EXISTS "DisciplinaryMeasure_collaboratorId_reason_idx" ON "DisciplinaryMeasure"("collaboratorId", "reason");
ALTER TABLE "DisciplinaryMeasure" ADD CONSTRAINT "DisciplinaryMeasure_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DisciplinaryMeasure" ADD CONSTRAINT "DisciplinaryMeasure_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
