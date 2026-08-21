-- CreateEnum
CREATE TYPE "EquipmentDamageStatus" AS ENUM ('ABERTO', 'EM_REPARO', 'RESOLVIDO');

-- AlterEnum
ALTER TYPE "AttachmentContext" ADD VALUE IF NOT EXISTS 'AVARIA';

-- CreateTable
CREATE TABLE "EquipmentDamage" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "collaboratorId" TEXT,
    "description" TEXT NOT NULL,
    "cost" DECIMAL(10,2),
    "status" "EquipmentDamageStatus" NOT NULL DEFAULT 'ABERTO',
    "notes" TEXT,
    "reportedById" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "EquipmentDamage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentDamage_code_key" ON "EquipmentDamage"("code");

-- CreateIndex
CREATE INDEX "EquipmentDamage_equipmentId_idx" ON "EquipmentDamage"("equipmentId");

-- CreateIndex
CREATE INDEX "EquipmentDamage_status_idx" ON "EquipmentDamage"("status");

-- CreateIndex
CREATE INDEX "EquipmentDamage_date_idx" ON "EquipmentDamage"("date");

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN "equipmentDamageId" TEXT;

-- CreateIndex
CREATE INDEX "Attachment_equipmentDamageId_idx" ON "Attachment"("equipmentDamageId");

-- AddForeignKey
ALTER TABLE "EquipmentDamage" ADD CONSTRAINT "EquipmentDamage_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentDamage" ADD CONSTRAINT "EquipmentDamage_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentDamage" ADD CONSTRAINT "EquipmentDamage_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_equipmentDamageId_fkey" FOREIGN KEY ("equipmentDamageId") REFERENCES "EquipmentDamage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
