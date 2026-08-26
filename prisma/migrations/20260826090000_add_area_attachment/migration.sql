-- AlterEnum
ALTER TYPE "AttachmentContext" ADD VALUE IF NOT EXISTS 'AREA';

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN "areaId" TEXT;

-- CreateIndex
CREATE INDEX "Attachment_areaId_idx" ON "Attachment"("areaId");

-- CreateIndex (faltava desde a migration do EquipmentDamage)
CREATE INDEX IF NOT EXISTS "Attachment_equipmentDamageId_idx" ON "Attachment"("equipmentDamageId");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;
