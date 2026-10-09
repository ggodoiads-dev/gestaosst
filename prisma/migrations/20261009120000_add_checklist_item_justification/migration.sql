-- CreateTable
CREATE TABLE "ChecklistItemJustification" (
    "id" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "reason" "ChecklistJustificationReason" NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistItemJustification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistItemJustification_collaboratorId_dayKey_itemId_key" ON "ChecklistItemJustification"("collaboratorId", "dayKey", "itemId");

-- CreateIndex
CREATE INDEX "ChecklistItemJustification_dayKey_idx" ON "ChecklistItemJustification"("dayKey");

-- AddForeignKey
ALTER TABLE "ChecklistItemJustification" ADD CONSTRAINT "ChecklistItemJustification_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItemJustification" ADD CONSTRAINT "ChecklistItemJustification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
