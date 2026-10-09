-- CreateTable
CREATE TABLE "DtoJustification" (
    "id" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DtoJustification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DtoJustification_collaboratorId_date_idx" ON "DtoJustification"("collaboratorId", "date");

-- AddForeignKey
ALTER TABLE "DtoJustification" ADD CONSTRAINT "DtoJustification_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DtoJustification" ADD CONSTRAINT "DtoJustification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
