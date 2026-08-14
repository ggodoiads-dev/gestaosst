-- AlterTable
ALTER TABLE "Turno" ADD COLUMN "endTime" TEXT;
ALTER TABLE "Turno" ADD COLUMN "startTime" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "context" TEXT NOT NULL,
    "docType" TEXT,
    "equipmentId" TEXT,
    "checklistAnswerId" TEXT,
    "nonconformityId" TEXT,
    "actionItemId" TEXT,
    "activityId" TEXT,
    "qualificationRecordId" TEXT,
    "accidentId" TEXT,
    "scheduleDayNoteId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attachment_checklistAnswerId_fkey" FOREIGN KEY ("checklistAnswerId") REFERENCES "ChecklistAnswer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attachment_nonconformityId_fkey" FOREIGN KEY ("nonconformityId") REFERENCES "Nonconformity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attachment_actionItemId_fkey" FOREIGN KEY ("actionItemId") REFERENCES "ActionItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attachment_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attachment_qualificationRecordId_fkey" FOREIGN KEY ("qualificationRecordId") REFERENCES "QualificationRecord" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attachment_accidentId_fkey" FOREIGN KEY ("accidentId") REFERENCES "Accident" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attachment_scheduleDayNoteId_fkey" FOREIGN KEY ("scheduleDayNoteId") REFERENCES "ScheduleDayNote" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Attachment" ("accidentId", "actionItemId", "activityId", "checklistAnswerId", "context", "docType", "equipmentId", "filename", "id", "mimeType", "nonconformityId", "path", "qualificationRecordId", "size", "uploadedAt", "uploadedById") SELECT "accidentId", "actionItemId", "activityId", "checklistAnswerId", "context", "docType", "equipmentId", "filename", "id", "mimeType", "nonconformityId", "path", "qualificationRecordId", "size", "uploadedAt", "uploadedById" FROM "Attachment";
DROP TABLE "Attachment";
ALTER TABLE "new_Attachment" RENAME TO "Attachment";
CREATE INDEX "Attachment_equipmentId_idx" ON "Attachment"("equipmentId");
CREATE INDEX "Attachment_nonconformityId_idx" ON "Attachment"("nonconformityId");
CREATE INDEX "Attachment_activityId_idx" ON "Attachment"("activityId");
CREATE INDEX "Attachment_qualificationRecordId_idx" ON "Attachment"("qualificationRecordId");
CREATE INDEX "Attachment_scheduleDayNoteId_idx" ON "Attachment"("scheduleDayNoteId");
CREATE INDEX "Attachment_accidentId_idx" ON "Attachment"("accidentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
