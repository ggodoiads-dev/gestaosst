-- CreateTable
CREATE TABLE IF NOT EXISTS "ChecklistDayResult" (
    "collaboratorId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "collaboratorName" TEXT NOT NULL,
    "areaName" TEXT,
    "required" INTEGER NOT NULL,
    "done" INTEGER NOT NULL,
    "frozenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChecklistDayResult_pkey" PRIMARY KEY ("collaboratorId","dayKey")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChecklistDayResult_dayKey_idx" ON "ChecklistDayResult"("dayKey");
