-- CreateTable
CREATE TABLE IF NOT EXISTS "AccidentInvolvedPerson" (
    "id" TEXT NOT NULL,
    "accidentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sap" TEXT,
    "cargo" TEXT,
    "collaboratorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccidentInvolvedPerson_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AccidentInvolvedPerson_accidentId_idx" ON "AccidentInvolvedPerson"("accidentId");
ALTER TABLE "AccidentInvolvedPerson" ADD CONSTRAINT "AccidentInvolvedPerson_accidentId_fkey" FOREIGN KEY ("accidentId") REFERENCES "Accident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
