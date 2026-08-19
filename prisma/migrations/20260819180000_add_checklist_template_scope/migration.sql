-- CreateEnum
CREATE TYPE "ChecklistTemplateScope" AS ENUM ('EQUIPAMENTO', 'AREA');

-- AlterTable
ALTER TABLE "ChecklistTemplate" ADD COLUMN     "scope" "ChecklistTemplateScope" NOT NULL DEFAULT 'EQUIPAMENTO',
ADD COLUMN     "areaId" TEXT;

-- CreateIndex
CREATE INDEX "ChecklistTemplate_areaId_idx" ON "ChecklistTemplate"("areaId");

-- AddForeignKey
ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;
