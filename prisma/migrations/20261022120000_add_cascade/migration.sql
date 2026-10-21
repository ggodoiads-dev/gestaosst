-- CreateTable
CREATE TABLE IF NOT EXISTS "CascadeNode" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerUserId" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'NUMBER',
    "polarity" TEXT NOT NULL DEFAULT 'HIGHER',
    "pace" TEXT NOT NULL DEFAULT 'NONE',
    "target" DOUBLE PRECISION,
    "impact" TEXT,
    "sigoKey" TEXT,
    "seedKey" TEXT,
    "reviewNote" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CascadeNode_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "CascadeValue" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CascadeValue_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CascadeNode_seedKey_key" ON "CascadeNode"("seedKey");
CREATE INDEX IF NOT EXISTS "CascadeNode_parentId_idx" ON "CascadeNode"("parentId");
CREATE UNIQUE INDEX IF NOT EXISTS "CascadeValue_nodeId_periodKey_key" ON "CascadeValue"("nodeId", "periodKey");
ALTER TABLE "CascadeNode" ADD CONSTRAINT "CascadeNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CascadeNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CascadeNode" ADD CONSTRAINT "CascadeNode_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CascadeValue" ADD CONSTRAINT "CascadeValue_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "CascadeNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CascadeValue" ADD CONSTRAINT "CascadeValue_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
