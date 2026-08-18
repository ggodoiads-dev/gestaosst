-- AlterEnum
ALTER TYPE "ScheduleDayNoteStatus" ADD VALUE 'BH_MAIS';

-- AlterTable
ALTER TABLE "ScheduleDayNote" ADD COLUMN "warningApplied" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ScheduleDayNote" ADD COLUMN "absenceInterviewDone" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Area" ADD COLUMN "qrToken" TEXT;
UPDATE "Area" SET "qrToken" = gen_random_uuid()::text WHERE "qrToken" IS NULL;
CREATE UNIQUE INDEX "Area_qrToken_key" ON "Area"("qrToken");

-- CreateTable
CREATE TABLE "CollaboratorEquipment" (
    "id" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollaboratorEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CollaboratorEquipment_collaboratorId_equipmentId_key" ON "CollaboratorEquipment"("collaboratorId", "equipmentId");

-- AddForeignKey
ALTER TABLE "CollaboratorEquipment" ADD CONSTRAINT "CollaboratorEquipment_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaboratorEquipment" ADD CONSTRAINT "CollaboratorEquipment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaboratorEquipment" ADD CONSTRAINT "CollaboratorEquipment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
