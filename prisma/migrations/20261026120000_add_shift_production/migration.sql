-- CreateTable
CREATE TABLE IF NOT EXISTS "ShiftProduction" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "turnoId" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShiftProduction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ShiftProduction_date_turnoId_key" ON "ShiftProduction"("date", "turnoId");
CREATE INDEX IF NOT EXISTS "ShiftProduction_date_idx" ON "ShiftProduction"("date");
ALTER TABLE "ShiftProduction" ADD CONSTRAINT "ShiftProduction_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "Turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShiftProduction" ADD CONSTRAINT "ShiftProduction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
