-- CreateEnum
CREATE TYPE "GuardianReportType" AS ENUM ('COMPORTAMENTO_RISCO', 'CONDICAO', 'INCIDENTE', 'RECONHECIMENTO');

-- CreateTable
CREATE TABLE "GuardianReport" (
    "id" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "type" "GuardianReportType" NOT NULL,
    "categoryName" TEXT,
    "description" TEXT,
    "occurredAt" TIMESTAMP(3),
    "reportedAt" TIMESTAMP(3),
    "unit" TEXT,
    "area" TEXT,
    "subArea" TEXT,
    "location" TEXT,
    "equipment" TEXT,
    "reporterName" TEXT,
    "reporterExternalId" TEXT,
    "reporterEmail" TEXT,
    "reporterCompany" TEXT,
    "reporterCollaboratorId" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "raw" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedById" TEXT NOT NULL,

    CONSTRAINT "GuardianReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuardianReport_guardianId_key" ON "GuardianReport"("guardianId");

-- CreateIndex
CREATE INDEX "GuardianReport_type_idx" ON "GuardianReport"("type");

-- CreateIndex
CREATE INDEX "GuardianReport_occurredAt_idx" ON "GuardianReport"("occurredAt");

-- CreateIndex
CREATE INDEX "GuardianReport_reporterCollaboratorId_idx" ON "GuardianReport"("reporterCollaboratorId");

-- AddForeignKey
ALTER TABLE "GuardianReport" ADD CONSTRAINT "GuardianReport_reporterCollaboratorId_fkey" FOREIGN KEY ("reporterCollaboratorId") REFERENCES "Collaborator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianReport" ADD CONSTRAINT "GuardianReport_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
