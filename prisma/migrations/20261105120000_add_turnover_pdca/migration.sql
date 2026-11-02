-- CreateTable
CREATE TABLE IF NOT EXISTS "TurnoverPdca" (
    "year" INTEGER NOT NULL,
    "owner" TEXT,
    "monthlyGoal" DOUBLE PRECISION,
    "ytdGoal" DOUBLE PRECISION,
    "annualGoal" DOUBLE PRECISION,
    "causes" JSONB NOT NULL DEFAULT '[]',
    "actions" JSONB NOT NULL DEFAULT '[]',
    "standardization" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TurnoverPdca_pkey" PRIMARY KEY ("year")
);
