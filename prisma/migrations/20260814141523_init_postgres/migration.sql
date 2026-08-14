-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('LIBERADO', 'LIBERADO_COM_OBSERVACAO', 'RESTRITO', 'BLOQUEADO', 'EM_MANUTENCAO', 'INATIVO');

-- CreateEnum
CREATE TYPE "Criticality" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('RASCUNHO', 'PUBLICADO', 'ARQUIVADO');

-- CreateEnum
CREATE TYPE "Periodicity" AS ENUM ('POR_TURNO', 'DIARIO', 'SEMANAL', 'MENSAL', 'ANTES_DO_USO', 'DEPOIS_DO_USO', 'PERSONALIZADO');

-- CreateEnum
CREATE TYPE "VersionStatus" AS ENUM ('RASCUNHO', 'ATIVA', 'RETIRADA');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('CONFORME_NAO_CONFORME', 'SIM_NAO', 'BOM_REGULAR_RUIM', 'MULTIPLA_ESCOLHA', 'SELECAO_UNICA', 'TEXTO_CURTO', 'TEXTO_LONGO', 'NUMERO', 'DATA', 'FOTO', 'CONFIRMACAO');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('EM_ANDAMENTO', 'CONCLUIDO', 'INVALIDADO');

-- CreateEnum
CREATE TYPE "ExecutionResult" AS ENUM ('LIBERADO', 'LIBERADO_COM_OBSERVACAO', 'RESTRITO', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "AttachmentContext" AS ENUM ('EQUIPAMENTO', 'RESPOSTA_CHECKLIST', 'NAO_CONFORMIDADE', 'ACAO', 'ATIVIDADE', 'QUALIFICACAO', 'ACIDENTE', 'ESCALA');

-- CreateEnum
CREATE TYPE "AttachmentDocType" AS ENUM ('POP', 'AR_VR', 'LISTA_TREINAMENTO');

-- CreateEnum
CREATE TYPE "NonconformityStatus" AS ENUM ('ABERTA', 'EM_ANALISE', 'ACAO_DEFINIDA', 'EM_EXECUCAO', 'AGUARDANDO_VERIFICACAO', 'CONCLUIDA', 'ENCERRADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "ActionItemStatus" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'VENCIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "ActionPriority" AS ENUM ('BAIXA', 'MEDIA', 'ALTA');

-- CreateEnum
CREATE TYPE "EquipmentEventType" AS ENUM ('EQUIPAMENTO_CADASTRADO', 'CHECKLIST_REALIZADO', 'DESVIO_IDENTIFICADO', 'NC_CRIADA', 'EQUIPAMENTO_BLOQUEADO', 'EQUIPAMENTO_RESTRITO', 'MANUTENCAO_INICIADA', 'MANUTENCAO_CONCLUIDA', 'ACAO_CRIADA', 'ACAO_CONCLUIDA', 'CORRECAO_VALIDADA', 'EQUIPAMENTO_LIBERADO', 'MUDANCA_DE_AREA', 'MUDANCA_DE_RESPONSAVEL', 'DOCUMENTO_ANEXADO', 'CHECKLIST_INVALIDADO');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('CHECKLIST_ATRASADO', 'EQUIPAMENTO_BLOQUEADO', 'NC_CRITICA', 'ACAO_PROXIMA_VENCIMENTO', 'ACAO_VENCIDA', 'EQUIPAMENTO_LIBERADO');

-- CreateEnum
CREATE TYPE "EpiDeliveryReason" AS ENUM ('PRIMEIRA_ENTREGA', 'SUBSTITUICAO_DANO_JUSTIFICADO', 'SUBSTITUICAO_DANO_PROPRIO_PERDA', 'TROCA_DANIFICADO_VENCIDO', 'DEVOLUCAO_DEMISSAO_MUDANCA_FUNCAO');

-- CreateEnum
CREATE TYPE "AccidentType" AS ENUM ('ACIDENTE_TIPICO', 'ACIDENTE_TRAJETO', 'QUASE_ACIDENTE', 'DOENCA_OCUPACIONAL');

-- CreateEnum
CREATE TYPE "AccidentStatus" AS ENUM ('ABERTO', 'EM_INVESTIGACAO', 'CONCLUIDO');

-- CreateEnum
CREATE TYPE "InvolvementRole" AS ENUM ('VITIMA', 'TESTEMUNHA');

-- CreateEnum
CREATE TYPE "SifClassification" AS ENUM ('SIF_PRECURSOR', 'SIF_POTENCIAL', 'SIF_REAL');

-- CreateEnum
CREATE TYPE "AccidentActionStatus" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "QualificationCategory" AS ENUM ('NR', 'ASO', 'INTEGRACAO', 'OUTRO');

-- CreateEnum
CREATE TYPE "ScheduleDayNoteStatus" AS ENUM ('FALTA', 'ATESTADO', 'FERIAS', 'TROCA', 'OUTRO');

-- CreateEnum
CREATE TYPE "ScheduleDayComputedStatus" AS ENUM ('TRABALHO', 'FOLGA');

-- CreateTable
CREATE TABLE "Sequence" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "unitId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserArea" (
    "userId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,

    CONSTRAINT "UserArea_pkey" PRIMARY KEY ("userId","areaId")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sector" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
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
    "status" "EquipmentStatus" NOT NULL DEFAULT 'LIBERADO',
    "criticality" "Criticality" NOT NULL DEFAULT 'MEDIA',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "qrToken" TEXT NOT NULL,
    "notes" TEXT,
    "registeredById" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentAreaHistory" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "previousAreaId" TEXT,
    "newAreaId" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "EquipmentAreaHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "equipmentTypeId" TEXT NOT NULL,
    "status" "TemplateStatus" NOT NULL DEFAULT 'RASCUNHO',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "periodicity" "Periodicity" NOT NULL,
    "status" "VersionStatus" NOT NULL DEFAULT 'RASCUNHO',
    "effectiveFrom" TIMESTAMP(3),
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistQuestion" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "QuestionType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "allowNotApplicable" BOOLEAN NOT NULL DEFAULT false,
    "guidance" TEXT,

    CONSTRAINT "ChecklistQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistQuestionOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "ChecklistQuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionRule" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "triggerValue" TEXT NOT NULL,
    "triggerOptionId" TEXT,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "requiresComment" BOOLEAN NOT NULL DEFAULT false,
    "requiresPhoto" BOOLEAN NOT NULL DEFAULT false,
    "createsNonconformity" BOOLEAN NOT NULL DEFAULT false,
    "blocksEquipment" BOOLEAN NOT NULL DEFAULT false,
    "newEquipmentStatus" "EquipmentStatus",
    "severity" "Criticality",
    "faultCategoryId" TEXT,

    CONSTRAINT "QuestionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaultCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "FaultCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentChecklistAssignment" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "EquipmentChecklistAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistSchedule" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "periodicity" "Periodicity" NOT NULL,
    "timeOfDay" TEXT,
    "daysOfWeek" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ChecklistSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistExecution" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "checklistVersionId" TEXT NOT NULL,
    "executedById" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "result" "ExecutionResult",
    "scheduledFor" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "delayMinutes" INTEGER,
    "invalidatedById" TEXT,
    "invalidatedAt" TIMESTAMP(3),
    "invalidationReason" TEXT,

    CONSTRAINT "ChecklistExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistAnswer" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "optionId" TEXT,
    "value" TEXT,
    "comment" TEXT,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "context" "AttachmentContext" NOT NULL,
    "docType" "AttachmentDocType",
    "equipmentId" TEXT,
    "checklistAnswerId" TEXT,
    "nonconformityId" TEXT,
    "actionItemId" TEXT,
    "activityId" TEXT,
    "qualificationRecordId" TEXT,
    "accidentId" TEXT,
    "scheduleDayNoteId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nonconformity" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "originExecutionId" TEXT,
    "originAnswerId" TEXT,
    "identifiedById" TEXT NOT NULL,
    "identifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "severity" "Criticality" NOT NULL,
    "faultCategoryId" TEXT,
    "responsibleId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "NonconformityStatus" NOT NULL DEFAULT 'ABERTA',

    CONSTRAINT "Nonconformity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionPlan" (
    "id" TEXT NOT NULL,
    "nonconformityId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionItem" (
    "id" TEXT NOT NULL,
    "actionPlanId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responsibleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "priority" "ActionPriority" NOT NULL DEFAULT 'MEDIA',
    "status" "ActionItemStatus" NOT NULL DEFAULT 'PENDENTE',
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "validatedById" TEXT,

    CONSTRAINT "ActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentEvent" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "type" "EquipmentEventType" NOT NULL,
    "description" TEXT NOT NULL,
    "userId" TEXT,
    "executionId" TEXT,
    "nonconformityId" TEXT,
    "actionItemId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collaborator" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "matricula" TEXT,
    "cargo" TEXT,
    "functionId" TEXT,
    "cpf" TEXT,
    "ctps" TEXT,
    "ctpsSerie" TEXT,
    "admissionDate" TIMESTAMP(3),
    "inactivatedAt" TIMESTAMP(3),
    "areaId" TEXT,
    "turnoId" TEXT,
    "phone" TEXT,
    "checklistEnabled" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Collaborator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobFunction" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobFunction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobFunctionEpiKitItem" (
    "id" TEXT NOT NULL,
    "jobFunctionId" TEXT NOT NULL,
    "epiTypeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "JobFunctionEpiKitItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EpiType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultCa" TEXT,
    "validityMonths" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpiType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EpiDelivery" (
    "id" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "epiTypeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "ca" TEXT,
    "size" TEXT,
    "reason" "EpiDeliveryReason" NOT NULL DEFAULT 'PRIMEIRA_ENTREGA',
    "deliveredAt" TIMESTAMP(3) NOT NULL,
    "returnedAt" TIMESTAMP(3),
    "traceable" BOOLEAN NOT NULL DEFAULT false,
    "qrToken" TEXT,
    "code" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpiDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Accident" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT,
    "areaId" TEXT,
    "type" "AccidentType" NOT NULL,
    "severity" "Criticality" NOT NULL,
    "description" TEXT NOT NULL,
    "immediateCause" TEXT,
    "rootCause" TEXT,
    "isSif" BOOLEAN NOT NULL DEFAULT false,
    "sifClassification" "SifClassification",
    "creditNumber" TEXT,
    "status" "AccidentStatus" NOT NULL DEFAULT 'ABERTO',
    "investigatedById" TEXT,
    "reportedById" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Accident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccidentInvolvement" (
    "accidentId" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "role" "InvolvementRole" NOT NULL,

    CONSTRAINT "AccidentInvolvement_pkey" PRIMARY KEY ("accidentId","collaboratorId")
);

-- CreateTable
CREATE TABLE "AccidentAction" (
    "id" TEXT NOT NULL,
    "accidentId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responsibleUserId" TEXT,
    "responsibleCollaboratorId" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "AccidentActionStatus" NOT NULL DEFAULT 'PENDENTE',
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccidentAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualificationType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "QualificationCategory" NOT NULL,
    "validityMonths" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualificationType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualificationRecord" (
    "id" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "qualificationTypeId" TEXT NOT NULL,
    "completedDate" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualificationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "unit" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductivityEntry" (
    "id" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "activityId" TEXT NOT NULL,
    "quantity" INTEGER,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductivityEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductivityGoal" (
    "id" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "targetQuantity" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductivityGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workDays" INTEGER NOT NULL,
    "restDays" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Turno" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scheduleTypeId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleDayNote" (
    "id" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "overrideStatus" "ScheduleDayComputedStatus" NOT NULL,
    "status" "ScheduleDayNoteStatus",
    "notes" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleDayNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftCheckIn" (
    "id" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftCheckIn_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "Attachment_activityId_idx" ON "Attachment"("activityId");

-- CreateIndex
CREATE INDEX "Attachment_qualificationRecordId_idx" ON "Attachment"("qualificationRecordId");

-- CreateIndex
CREATE INDEX "Attachment_scheduleDayNoteId_idx" ON "Attachment"("scheduleDayNoteId");

-- CreateIndex
CREATE INDEX "Attachment_accidentId_idx" ON "Attachment"("accidentId");

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

-- CreateIndex
CREATE UNIQUE INDEX "Collaborator_matricula_key" ON "Collaborator"("matricula");

-- CreateIndex
CREATE UNIQUE INDEX "Collaborator_userId_key" ON "Collaborator"("userId");

-- CreateIndex
CREATE INDEX "Collaborator_areaId_idx" ON "Collaborator"("areaId");

-- CreateIndex
CREATE INDEX "Collaborator_functionId_idx" ON "Collaborator"("functionId");

-- CreateIndex
CREATE UNIQUE INDEX "JobFunction_name_key" ON "JobFunction"("name");

-- CreateIndex
CREATE INDEX "JobFunctionEpiKitItem_epiTypeId_idx" ON "JobFunctionEpiKitItem"("epiTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "JobFunctionEpiKitItem_jobFunctionId_epiTypeId_key" ON "JobFunctionEpiKitItem"("jobFunctionId", "epiTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "EpiType_name_key" ON "EpiType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EpiDelivery_qrToken_key" ON "EpiDelivery"("qrToken");

-- CreateIndex
CREATE UNIQUE INDEX "EpiDelivery_code_key" ON "EpiDelivery"("code");

-- CreateIndex
CREATE INDEX "EpiDelivery_collaboratorId_idx" ON "EpiDelivery"("collaboratorId");

-- CreateIndex
CREATE INDEX "EpiDelivery_epiTypeId_idx" ON "EpiDelivery"("epiTypeId");

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
CREATE UNIQUE INDEX "QualificationType_name_key" ON "QualificationType"("name");

-- CreateIndex
CREATE INDEX "QualificationRecord_collaboratorId_idx" ON "QualificationRecord"("collaboratorId");

-- CreateIndex
CREATE INDEX "QualificationRecord_qualificationTypeId_idx" ON "QualificationRecord"("qualificationTypeId");

-- CreateIndex
CREATE INDEX "QualificationRecord_expiresAt_idx" ON "QualificationRecord"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_code_key" ON "Activity"("code");

-- CreateIndex
CREATE INDEX "ProductivityEntry_collaboratorId_date_idx" ON "ProductivityEntry"("collaboratorId", "date");

-- CreateIndex
CREATE INDEX "ProductivityEntry_activityId_idx" ON "ProductivityEntry"("activityId");

-- CreateIndex
CREATE INDEX "ProductivityGoal_month_year_idx" ON "ProductivityGoal"("month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "ProductivityGoal_collaboratorId_activityId_month_year_key" ON "ProductivityGoal"("collaboratorId", "activityId", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleType_name_key" ON "ScheduleType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Turno_name_key" ON "Turno"("name");

-- CreateIndex
CREATE INDEX "ScheduleDayNote_collaboratorId_idx" ON "ScheduleDayNote"("collaboratorId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleDayNote_collaboratorId_date_key" ON "ScheduleDayNote"("collaboratorId", "date");

-- CreateIndex
CREATE INDEX "ShiftCheckIn_collaboratorId_date_idx" ON "ShiftCheckIn"("collaboratorId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftCheckIn_collaboratorId_date_key" ON "ShiftCheckIn"("collaboratorId", "date");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserArea" ADD CONSTRAINT "UserArea_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserArea" ADD CONSTRAINT "UserArea_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "EquipmentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAreaHistory" ADD CONSTRAINT "EquipmentAreaHistory_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAreaHistory" ADD CONSTRAINT "EquipmentAreaHistory_previousAreaId_fkey" FOREIGN KEY ("previousAreaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAreaHistory" ADD CONSTRAINT "EquipmentAreaHistory_newAreaId_fkey" FOREIGN KEY ("newAreaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAreaHistory" ADD CONSTRAINT "EquipmentAreaHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_equipmentTypeId_fkey" FOREIGN KEY ("equipmentTypeId") REFERENCES "EquipmentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistVersion" ADD CONSTRAINT "ChecklistVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistVersion" ADD CONSTRAINT "ChecklistVersion_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistQuestion" ADD CONSTRAINT "ChecklistQuestion_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ChecklistVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistQuestionOption" ADD CONSTRAINT "ChecklistQuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ChecklistQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionRule" ADD CONSTRAINT "QuestionRule_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ChecklistQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionRule" ADD CONSTRAINT "QuestionRule_triggerOptionId_fkey" FOREIGN KEY ("triggerOptionId") REFERENCES "ChecklistQuestionOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionRule" ADD CONSTRAINT "QuestionRule_faultCategoryId_fkey" FOREIGN KEY ("faultCategoryId") REFERENCES "FaultCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentChecklistAssignment" ADD CONSTRAINT "EquipmentChecklistAssignment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentChecklistAssignment" ADD CONSTRAINT "EquipmentChecklistAssignment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistSchedule" ADD CONSTRAINT "ChecklistSchedule_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistSchedule" ADD CONSTRAINT "ChecklistSchedule_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistSchedule" ADD CONSTRAINT "ChecklistSchedule_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ChecklistVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistExecution" ADD CONSTRAINT "ChecklistExecution_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistExecution" ADD CONSTRAINT "ChecklistExecution_checklistVersionId_fkey" FOREIGN KEY ("checklistVersionId") REFERENCES "ChecklistVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistExecution" ADD CONSTRAINT "ChecklistExecution_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistExecution" ADD CONSTRAINT "ChecklistExecution_invalidatedById_fkey" FOREIGN KEY ("invalidatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistAnswer" ADD CONSTRAINT "ChecklistAnswer_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ChecklistExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistAnswer" ADD CONSTRAINT "ChecklistAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ChecklistQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_checklistAnswerId_fkey" FOREIGN KEY ("checklistAnswerId") REFERENCES "ChecklistAnswer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_nonconformityId_fkey" FOREIGN KEY ("nonconformityId") REFERENCES "Nonconformity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_actionItemId_fkey" FOREIGN KEY ("actionItemId") REFERENCES "ActionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_qualificationRecordId_fkey" FOREIGN KEY ("qualificationRecordId") REFERENCES "QualificationRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_accidentId_fkey" FOREIGN KEY ("accidentId") REFERENCES "Accident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_scheduleDayNoteId_fkey" FOREIGN KEY ("scheduleDayNoteId") REFERENCES "ScheduleDayNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nonconformity" ADD CONSTRAINT "Nonconformity_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nonconformity" ADD CONSTRAINT "Nonconformity_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nonconformity" ADD CONSTRAINT "Nonconformity_originExecutionId_fkey" FOREIGN KEY ("originExecutionId") REFERENCES "ChecklistExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nonconformity" ADD CONSTRAINT "Nonconformity_originAnswerId_fkey" FOREIGN KEY ("originAnswerId") REFERENCES "ChecklistAnswer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nonconformity" ADD CONSTRAINT "Nonconformity_identifiedById_fkey" FOREIGN KEY ("identifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nonconformity" ADD CONSTRAINT "Nonconformity_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nonconformity" ADD CONSTRAINT "Nonconformity_faultCategoryId_fkey" FOREIGN KEY ("faultCategoryId") REFERENCES "FaultCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionPlan" ADD CONSTRAINT "ActionPlan_nonconformityId_fkey" FOREIGN KEY ("nonconformityId") REFERENCES "Nonconformity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionPlan" ADD CONSTRAINT "ActionPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_actionPlanId_fkey" FOREIGN KEY ("actionPlanId") REFERENCES "ActionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentEvent" ADD CONSTRAINT "EquipmentEvent_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentEvent" ADD CONSTRAINT "EquipmentEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentEvent" ADD CONSTRAINT "EquipmentEvent_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ChecklistExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentEvent" ADD CONSTRAINT "EquipmentEvent_nonconformityId_fkey" FOREIGN KEY ("nonconformityId") REFERENCES "Nonconformity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentEvent" ADD CONSTRAINT "EquipmentEvent_actionItemId_fkey" FOREIGN KEY ("actionItemId") REFERENCES "ActionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collaborator" ADD CONSTRAINT "Collaborator_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collaborator" ADD CONSTRAINT "Collaborator_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "Turno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collaborator" ADD CONSTRAINT "Collaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collaborator" ADD CONSTRAINT "Collaborator_functionId_fkey" FOREIGN KEY ("functionId") REFERENCES "JobFunction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobFunctionEpiKitItem" ADD CONSTRAINT "JobFunctionEpiKitItem_jobFunctionId_fkey" FOREIGN KEY ("jobFunctionId") REFERENCES "JobFunction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobFunctionEpiKitItem" ADD CONSTRAINT "JobFunctionEpiKitItem_epiTypeId_fkey" FOREIGN KEY ("epiTypeId") REFERENCES "EpiType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpiDelivery" ADD CONSTRAINT "EpiDelivery_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpiDelivery" ADD CONSTRAINT "EpiDelivery_epiTypeId_fkey" FOREIGN KEY ("epiTypeId") REFERENCES "EpiType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpiDelivery" ADD CONSTRAINT "EpiDelivery_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accident" ADD CONSTRAINT "Accident_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accident" ADD CONSTRAINT "Accident_investigatedById_fkey" FOREIGN KEY ("investigatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accident" ADD CONSTRAINT "Accident_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccidentInvolvement" ADD CONSTRAINT "AccidentInvolvement_accidentId_fkey" FOREIGN KEY ("accidentId") REFERENCES "Accident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccidentInvolvement" ADD CONSTRAINT "AccidentInvolvement_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccidentAction" ADD CONSTRAINT "AccidentAction_accidentId_fkey" FOREIGN KEY ("accidentId") REFERENCES "Accident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccidentAction" ADD CONSTRAINT "AccidentAction_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccidentAction" ADD CONSTRAINT "AccidentAction_responsibleCollaboratorId_fkey" FOREIGN KEY ("responsibleCollaboratorId") REFERENCES "Collaborator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualificationRecord" ADD CONSTRAINT "QualificationRecord_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualificationRecord" ADD CONSTRAINT "QualificationRecord_qualificationTypeId_fkey" FOREIGN KEY ("qualificationTypeId") REFERENCES "QualificationType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualificationRecord" ADD CONSTRAINT "QualificationRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductivityEntry" ADD CONSTRAINT "ProductivityEntry_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductivityEntry" ADD CONSTRAINT "ProductivityEntry_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductivityEntry" ADD CONSTRAINT "ProductivityEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductivityGoal" ADD CONSTRAINT "ProductivityGoal_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductivityGoal" ADD CONSTRAINT "ProductivityGoal_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductivityGoal" ADD CONSTRAINT "ProductivityGoal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turno" ADD CONSTRAINT "Turno_scheduleTypeId_fkey" FOREIGN KEY ("scheduleTypeId") REFERENCES "ScheduleType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turno" ADD CONSTRAINT "Turno_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleDayNote" ADD CONSTRAINT "ScheduleDayNote_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleDayNote" ADD CONSTRAINT "ScheduleDayNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftCheckIn" ADD CONSTRAINT "ShiftCheckIn_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
