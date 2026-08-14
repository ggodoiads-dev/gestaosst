-- CreateTable
CREATE TABLE "Collaborator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "matricula" TEXT,
    "cargo" TEXT,
    "admissionDate" DATETIME,
    "areaId" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Collaborator_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Accident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "time" TEXT,
    "areaId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "immediateCause" TEXT,
    "rootCause" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    "investigatedById" TEXT,
    "reportedById" TEXT NOT NULL,
    "reportedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    CONSTRAINT "Accident_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Accident_investigatedById_fkey" FOREIGN KEY ("investigatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Accident_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccidentInvolvement" (
    "accidentId" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    PRIMARY KEY ("accidentId", "collaboratorId"),
    CONSTRAINT "AccidentInvolvement_accidentId_fkey" FOREIGN KEY ("accidentId") REFERENCES "Accident" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccidentInvolvement_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccidentAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accidentId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responsibleUserId" TEXT,
    "responsibleCollaboratorId" TEXT,
    "dueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "completedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccidentAction_accidentId_fkey" FOREIGN KEY ("accidentId") REFERENCES "Accident" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AccidentAction_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AccidentAction_responsibleCollaboratorId_fkey" FOREIGN KEY ("responsibleCollaboratorId") REFERENCES "Collaborator" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QualificationType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "validityMonths" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "QualificationRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "collaboratorId" TEXT NOT NULL,
    "qualificationTypeId" TEXT NOT NULL,
    "completedDate" DATETIME NOT NULL,
    "expiresAt" DATETIME,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QualificationRecord_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QualificationRecord_qualificationTypeId_fkey" FOREIGN KEY ("qualificationTypeId") REFERENCES "QualificationType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QualificationRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attachment_checklistAnswerId_fkey" FOREIGN KEY ("checklistAnswerId") REFERENCES "ChecklistAnswer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attachment_nonconformityId_fkey" FOREIGN KEY ("nonconformityId") REFERENCES "Nonconformity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attachment_actionItemId_fkey" FOREIGN KEY ("actionItemId") REFERENCES "ActionItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attachment_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attachment_qualificationRecordId_fkey" FOREIGN KEY ("qualificationRecordId") REFERENCES "QualificationRecord" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attachment_accidentId_fkey" FOREIGN KEY ("accidentId") REFERENCES "Accident" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Attachment" ("actionItemId", "checklistAnswerId", "context", "equipmentId", "filename", "id", "mimeType", "nonconformityId", "path", "size", "uploadedAt", "uploadedById") SELECT "actionItemId", "checklistAnswerId", "context", "equipmentId", "filename", "id", "mimeType", "nonconformityId", "path", "size", "uploadedAt", "uploadedById" FROM "Attachment";
DROP TABLE "Attachment";
ALTER TABLE "new_Attachment" RENAME TO "Attachment";
CREATE INDEX "Attachment_equipmentId_idx" ON "Attachment"("equipmentId");
CREATE INDEX "Attachment_nonconformityId_idx" ON "Attachment"("nonconformityId");
CREATE INDEX "Attachment_activityId_idx" ON "Attachment"("activityId");
CREATE INDEX "Attachment_qualificationRecordId_idx" ON "Attachment"("qualificationRecordId");
CREATE INDEX "Attachment_accidentId_idx" ON "Attachment"("accidentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Collaborator_matricula_key" ON "Collaborator"("matricula");

-- CreateIndex
CREATE INDEX "Collaborator_areaId_idx" ON "Collaborator"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "Accident_code_key" ON "Accident"("code");

-- CreateIndex
CREATE INDEX "Accident_status_idx" ON "Accident"("status");

-- CreateIndex
CREATE INDEX "Accident_date_idx" ON "Accident"("date");

-- CreateIndex
CREATE INDEX "Accident_areaId_idx" ON "Accident"("areaId");

-- CreateIndex
CREATE INDEX "AccidentAction_accidentId_idx" ON "AccidentAction"("accidentId");

-- CreateIndex
CREATE INDEX "AccidentAction_status_idx" ON "AccidentAction"("status");

-- CreateIndex
CREATE INDEX "AccidentAction_dueDate_idx" ON "AccidentAction"("dueDate");

-- CreateIndex
CREATE INDEX "QualificationRecord_collaboratorId_idx" ON "QualificationRecord"("collaboratorId");

-- CreateIndex
CREATE INDEX "QualificationRecord_qualificationTypeId_idx" ON "QualificationRecord"("qualificationTypeId");

-- CreateIndex
CREATE INDEX "QualificationRecord_expiresAt_idx" ON "QualificationRecord"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_code_key" ON "Activity"("code");
