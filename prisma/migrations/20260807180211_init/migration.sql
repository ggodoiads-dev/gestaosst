-- CreateTable
CREATE TABLE "Sequence" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    PRIMARY KEY ("roleId", "permissionId"),
    CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "unitId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" DATETIME,
    CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "User_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserArea" (
    "userId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,

    PRIMARY KEY ("userId", "areaId"),
    CONSTRAINT "UserArea_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserArea_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sector" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Area_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EquipmentType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "assetTag" TEXT,
    "name" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "unitId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "sector" TEXT,
    "responsibleId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'LIBERADO',
    "criticality" TEXT NOT NULL DEFAULT 'MEDIA',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "qrToken" TEXT NOT NULL,
    "notes" TEXT,
    "registeredById" TEXT NOT NULL,
    "registeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Equipment_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "EquipmentType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Equipment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Equipment_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Equipment_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Equipment_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EquipmentAreaHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "equipmentId" TEXT NOT NULL,
    "previousAreaId" TEXT,
    "newAreaId" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    CONSTRAINT "EquipmentAreaHistory_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EquipmentAreaHistory_previousAreaId_fkey" FOREIGN KEY ("previousAreaId") REFERENCES "Area" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EquipmentAreaHistory_newAreaId_fkey" FOREIGN KEY ("newAreaId") REFERENCES "Area" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EquipmentAreaHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "equipmentTypeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChecklistTemplate_equipmentTypeId_fkey" FOREIGN KEY ("equipmentTypeId") REFERENCES "EquipmentType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChecklistTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "periodicity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "effectiveFrom" DATETIME,
    "publishedById" TEXT,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChecklistVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChecklistVersion_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "allowNotApplicable" BOOLEAN NOT NULL DEFAULT false,
    "guidance" TEXT,
    CONSTRAINT "ChecklistQuestion_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ChecklistVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistQuestionOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "ChecklistQuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ChecklistQuestion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "triggerValue" TEXT NOT NULL,
    "triggerOptionId" TEXT,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "requiresComment" BOOLEAN NOT NULL DEFAULT false,
    "requiresPhoto" BOOLEAN NOT NULL DEFAULT false,
    "createsNonconformity" BOOLEAN NOT NULL DEFAULT false,
    "blocksEquipment" BOOLEAN NOT NULL DEFAULT false,
    "newEquipmentStatus" TEXT,
    "severity" TEXT,
    "faultCategoryId" TEXT,
    CONSTRAINT "QuestionRule_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ChecklistQuestion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuestionRule_triggerOptionId_fkey" FOREIGN KEY ("triggerOptionId") REFERENCES "ChecklistQuestionOption" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QuestionRule_faultCategoryId_fkey" FOREIGN KEY ("faultCategoryId") REFERENCES "FaultCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FaultCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "EquipmentChecklistAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "equipmentId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "EquipmentChecklistAssignment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EquipmentChecklistAssignment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "equipmentId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "periodicity" TEXT NOT NULL,
    "timeOfDay" TEXT,
    "daysOfWeek" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ChecklistSchedule_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChecklistSchedule_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChecklistSchedule_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ChecklistVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "checklistVersionId" TEXT NOT NULL,
    "executedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EM_ANDAMENTO',
    "result" TEXT,
    "scheduledFor" DATETIME,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "delayMinutes" INTEGER,
    "invalidatedById" TEXT,
    "invalidatedAt" DATETIME,
    "invalidationReason" TEXT,
    CONSTRAINT "ChecklistExecution_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChecklistExecution_checklistVersionId_fkey" FOREIGN KEY ("checklistVersionId") REFERENCES "ChecklistVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChecklistExecution_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChecklistExecution_invalidatedById_fkey" FOREIGN KEY ("invalidatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "executionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "optionId" TEXT,
    "value" TEXT,
    "comment" TEXT,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChecklistAnswer_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ChecklistExecution" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChecklistAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ChecklistQuestion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "context" TEXT NOT NULL,
    "equipmentId" TEXT,
    "checklistAnswerId" TEXT,
    "nonconformityId" TEXT,
    "actionItemId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attachment_checklistAnswerId_fkey" FOREIGN KEY ("checklistAnswerId") REFERENCES "ChecklistAnswer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attachment_nonconformityId_fkey" FOREIGN KEY ("nonconformityId") REFERENCES "Nonconformity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attachment_actionItemId_fkey" FOREIGN KEY ("actionItemId") REFERENCES "ActionItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Nonconformity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "originExecutionId" TEXT,
    "originAnswerId" TEXT,
    "identifiedById" TEXT NOT NULL,
    "identifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "faultCategoryId" TEXT,
    "responsibleId" TEXT,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ABERTA',
    CONSTRAINT "Nonconformity_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Nonconformity_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Nonconformity_originExecutionId_fkey" FOREIGN KEY ("originExecutionId") REFERENCES "ChecklistExecution" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Nonconformity_originAnswerId_fkey" FOREIGN KEY ("originAnswerId") REFERENCES "ChecklistAnswer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Nonconformity_identifiedById_fkey" FOREIGN KEY ("identifiedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Nonconformity_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Nonconformity_faultCategoryId_fkey" FOREIGN KEY ("faultCategoryId") REFERENCES "FaultCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActionPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nonconformityId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActionPlan_nonconformityId_fkey" FOREIGN KEY ("nonconformityId") REFERENCES "Nonconformity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ActionPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actionPlanId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responsibleId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATETIME NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIA',
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "notes" TEXT,
    "completedAt" DATETIME,
    "completedById" TEXT,
    "validatedAt" DATETIME,
    "validatedById" TEXT,
    CONSTRAINT "ActionItem_actionPlanId_fkey" FOREIGN KEY ("actionPlanId") REFERENCES "ActionPlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ActionItem_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ActionItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ActionItem_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EquipmentEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "equipmentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "userId" TEXT,
    "executionId" TEXT,
    "nonconformityId" TEXT,
    "actionItemId" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EquipmentEvent_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EquipmentEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EquipmentEvent_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ChecklistExecution" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EquipmentEvent_nonconformityId_fkey" FOREIGN KEY ("nonconformityId") REFERENCES "Nonconformity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EquipmentEvent_actionItemId_fkey" FOREIGN KEY ("actionItemId") REFERENCES "ActionItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_code_key" ON "Unit"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Area_code_key" ON "Area"("code");

-- CreateIndex
CREATE INDEX "Area_unitId_idx" ON "Area"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentType_code_key" ON "EquipmentType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_code_key" ON "Equipment"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_qrToken_key" ON "Equipment"("qrToken");

-- CreateIndex
CREATE INDEX "Equipment_typeId_idx" ON "Equipment"("typeId");

-- CreateIndex
CREATE INDEX "Equipment_areaId_idx" ON "Equipment"("areaId");

-- CreateIndex
CREATE INDEX "Equipment_status_idx" ON "Equipment"("status");

-- CreateIndex
CREATE INDEX "Equipment_criticality_idx" ON "Equipment"("criticality");

-- CreateIndex
CREATE INDEX "EquipmentAreaHistory_equipmentId_idx" ON "EquipmentAreaHistory"("equipmentId");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_equipmentTypeId_idx" ON "ChecklistTemplate"("equipmentTypeId");

-- CreateIndex
CREATE INDEX "ChecklistVersion_templateId_idx" ON "ChecklistVersion"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistVersion_templateId_versionNumber_key" ON "ChecklistVersion"("templateId", "versionNumber");

-- CreateIndex
CREATE INDEX "ChecklistQuestion_versionId_idx" ON "ChecklistQuestion"("versionId");

-- CreateIndex
CREATE INDEX "ChecklistQuestionOption_questionId_idx" ON "ChecklistQuestionOption"("questionId");

-- CreateIndex
CREATE INDEX "QuestionRule_questionId_idx" ON "QuestionRule"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "FaultCategory_name_key" ON "FaultCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentChecklistAssignment_equipmentId_templateId_key" ON "EquipmentChecklistAssignment"("equipmentId", "templateId");

-- CreateIndex
CREATE INDEX "ChecklistSchedule_equipmentId_idx" ON "ChecklistSchedule"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistExecution_code_key" ON "ChecklistExecution"("code");

-- CreateIndex
CREATE INDEX "ChecklistExecution_equipmentId_idx" ON "ChecklistExecution"("equipmentId");

-- CreateIndex
CREATE INDEX "ChecklistExecution_status_idx" ON "ChecklistExecution"("status");

-- CreateIndex
CREATE INDEX "ChecklistExecution_startedAt_idx" ON "ChecklistExecution"("startedAt");

-- CreateIndex
CREATE INDEX "ChecklistAnswer_questionId_idx" ON "ChecklistAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistAnswer_executionId_questionId_key" ON "ChecklistAnswer"("executionId", "questionId");

-- CreateIndex
CREATE INDEX "Attachment_equipmentId_idx" ON "Attachment"("equipmentId");

-- CreateIndex
CREATE INDEX "Attachment_nonconformityId_idx" ON "Attachment"("nonconformityId");

-- CreateIndex
CREATE UNIQUE INDEX "Nonconformity_code_key" ON "Nonconformity"("code");

-- CreateIndex
CREATE INDEX "Nonconformity_equipmentId_idx" ON "Nonconformity"("equipmentId");

-- CreateIndex
CREATE INDEX "Nonconformity_status_idx" ON "Nonconformity"("status");

-- CreateIndex
CREATE INDEX "Nonconformity_severity_idx" ON "Nonconformity"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "ActionPlan_nonconformityId_key" ON "ActionPlan"("nonconformityId");

-- CreateIndex
CREATE INDEX "ActionItem_actionPlanId_idx" ON "ActionItem"("actionPlanId");

-- CreateIndex
CREATE INDEX "ActionItem_status_idx" ON "ActionItem"("status");

-- CreateIndex
CREATE INDEX "ActionItem_dueDate_idx" ON "ActionItem"("dueDate");

-- CreateIndex
CREATE INDEX "EquipmentEvent_equipmentId_occurredAt_idx" ON "EquipmentEvent"("equipmentId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_occurredAt_idx" ON "AuditLog"("occurredAt");
