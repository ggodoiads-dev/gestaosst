-- CreateTable
CREATE TABLE IF NOT EXISTS "ExitInterview" (
    "id" TEXT NOT NULL,
    "terminationId" TEXT NOT NULL,
    "conductedAt" TIMESTAMP(3) NOT NULL,
    "interviewer" TEXT,
    "primaryReason" TEXT NOT NULL,
    "secondaryReasons" JSONB NOT NULL DEFAULT '[]',
    "ratings" JSONB NOT NULL DEFAULT '{}',
    "wouldReturn" TEXT,
    "destination" TEXT,
    "comments" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExitInterview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TurnoverHeadcount" (
    "month" TEXT NOT NULL,
    "headcount" INTEGER NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TurnoverHeadcount_pkey" PRIMARY KEY ("month")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ExitInterview_terminationId_key" ON "ExitInterview"("terminationId");
CREATE INDEX IF NOT EXISTS "ExitInterview_conductedAt_idx" ON "ExitInterview"("conductedAt");
