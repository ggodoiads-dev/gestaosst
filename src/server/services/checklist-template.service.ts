import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import type { Periodicity, QuestionType, Criticality, EquipmentStatus } from "@/generated/prisma/enums";

export function listTemplates() {
  return db.checklistTemplate.findMany({
    include: {
      equipmentType: true,
      versions: { orderBy: { versionNumber: "desc" }, take: 1 },
      _count: { select: { assignments: true } },
    },
    orderBy: { name: "asc" },
  });
}

export function getTemplateDetail(id: string) {
  return db.checklistTemplate.findUniqueOrThrow({
    where: { id },
    include: {
      equipmentType: true,
      versions: {
        orderBy: { versionNumber: "desc" },
        include: {
          questions: {
            orderBy: { order: "asc" },
            include: { options: { orderBy: { order: "asc" } }, rules: true },
          },
        },
      },
      assignments: { include: { equipment: true } },
    },
  });
}

export async function createTemplate(
  user: CurrentUser,
  data: { name: string; description?: string | null; equipmentTypeId: string },
) {
  requirePermission(user, PERMISSIONS.CHECKLIST_TEMPLATE_MANAGE);

  const template = await db.$transaction(async (tx) => {
    const created = await tx.checklistTemplate.create({
      data: { ...data, createdById: user.id, status: "RASCUNHO" },
    });
    await tx.checklistVersion.create({
      data: { templateId: created.id, versionNumber: 1, periodicity: "DIARIO", status: "RASCUNHO" },
    });
    await recordAudit(
      { userId: user.id, action: "CREATE", entityType: "ChecklistTemplate", entityId: created.id, newValue: data },
      tx,
    );
    return created;
  });

  return template;
}

async function getDraftVersionOrThrow(versionId: string) {
  const version = await db.checklistVersion.findUniqueOrThrow({ where: { id: versionId } });
  if (version.status !== "RASCUNHO") {
    throw new ForbiddenError("Só é possível editar perguntas de uma versão em rascunho.");
  }
  return version;
}

export async function createNewDraftVersion(user: CurrentUser, templateId: string) {
  requirePermission(user, PERMISSIONS.CHECKLIST_TEMPLATE_MANAGE);

  const lastVersion = await db.checklistVersion.findFirst({
    where: { templateId },
    orderBy: { versionNumber: "desc" },
    include: { questions: { include: { options: true, rules: true } } },
  });

  if (!lastVersion) throw new Error("Modelo sem versão base.");
  if (lastVersion.status === "RASCUNHO") return lastVersion;

  const version = await db.$transaction(async (tx) => {
    const created = await tx.checklistVersion.create({
      data: {
        templateId,
        versionNumber: lastVersion.versionNumber + 1,
        periodicity: lastVersion.periodicity,
        status: "RASCUNHO",
      },
    });

    for (const question of lastVersion.questions) {
      const newQuestion = await tx.checklistQuestion.create({
        data: {
          versionId: created.id,
          order: question.order,
          title: question.title,
          description: question.description,
          type: question.type,
          required: question.required,
          allowNotApplicable: question.allowNotApplicable,
          guidance: question.guidance,
        },
      });

      const optionIdMap = new Map<string, string>();
      for (const option of question.options) {
        const newOption = await tx.checklistQuestionOption.create({
          data: { questionId: newQuestion.id, label: option.label, value: option.value, order: option.order },
        });
        optionIdMap.set(option.id, newOption.id);
      }

      for (const rule of question.rules) {
        await tx.questionRule.create({
          data: {
            questionId: newQuestion.id,
            triggerValue: rule.triggerValue,
            triggerOptionId: rule.triggerOptionId ? optionIdMap.get(rule.triggerOptionId) : null,
            isCritical: rule.isCritical,
            requiresComment: rule.requiresComment,
            requiresPhoto: rule.requiresPhoto,
            createsNonconformity: rule.createsNonconformity,
            blocksEquipment: rule.blocksEquipment,
            newEquipmentStatus: rule.newEquipmentStatus,
            severity: rule.severity,
            faultCategoryId: rule.faultCategoryId,
          },
        });
      }
    }

    await recordAudit(
      {
        userId: user.id,
        action: "CREATE",
        entityType: "ChecklistVersion",
        entityId: created.id,
        newValue: { templateId, versionNumber: created.versionNumber },
      },
      tx,
    );

    return created;
  });

  return version;
}

export async function updateVersionPeriodicity(
  user: CurrentUser,
  versionId: string,
  periodicity: Periodicity,
) {
  requirePermission(user, PERMISSIONS.CHECKLIST_TEMPLATE_MANAGE);
  await getDraftVersionOrThrow(versionId);
  return db.checklistVersion.update({ where: { id: versionId }, data: { periodicity } });
}

export async function publishVersion(user: CurrentUser, versionId: string) {
  requirePermission(user, PERMISSIONS.CHECKLIST_TEMPLATE_MANAGE);
  const version = await db.checklistVersion.findUniqueOrThrow({ where: { id: versionId } });

  const questionCount = await db.checklistQuestion.count({ where: { versionId } });
  if (questionCount === 0) {
    throw new ForbiddenError("Adicione ao menos uma pergunta antes de publicar a versão.");
  }

  await db.$transaction(async (tx) => {
    await tx.checklistVersion.updateMany({
      where: { templateId: version.templateId, status: "ATIVA" },
      data: { status: "RETIRADA" },
    });
    await tx.checklistVersion.update({
      where: { id: versionId },
      data: { status: "ATIVA", publishedById: user.id, publishedAt: new Date(), effectiveFrom: new Date() },
    });
    await tx.checklistTemplate.update({
      where: { id: version.templateId },
      data: { status: "PUBLICADO" },
    });
    await recordAudit(
      {
        userId: user.id,
        action: "PUBLISH_VERSION",
        entityType: "ChecklistVersion",
        entityId: versionId,
        newValue: { versionNumber: version.versionNumber },
      },
      tx,
    );
  });
}

export type QuestionInput = {
  title: string;
  description?: string | null;
  type: QuestionType;
  required: boolean;
  allowNotApplicable: boolean;
  guidance?: string | null;
  options?: { label: string; value: string }[];
  rule?: {
    triggerValue: string;
    isCritical: boolean;
    requiresComment: boolean;
    requiresPhoto: boolean;
    createsNonconformity: boolean;
    blocksEquipment: boolean;
    newEquipmentStatus?: EquipmentStatus | null;
    severity?: Criticality | null;
    faultCategoryId?: string | null;
  } | null;
};

export async function addQuestion(user: CurrentUser, versionId: string, input: QuestionInput) {
  requirePermission(user, PERMISSIONS.CHECKLIST_TEMPLATE_MANAGE);
  await getDraftVersionOrThrow(versionId);

  const maxOrder = await db.checklistQuestion.aggregate({
    where: { versionId },
    _max: { order: true },
  });

  return db.$transaction(async (tx) => {
    const question = await tx.checklistQuestion.create({
      data: {
        versionId,
        order: (maxOrder._max.order ?? 0) + 1,
        title: input.title,
        description: input.description,
        type: input.type,
        required: input.required,
        allowNotApplicable: input.allowNotApplicable,
        guidance: input.guidance,
      },
    });

    let triggerOptionId: string | null = null;
    if (input.options && input.options.length > 0) {
      for (let i = 0; i < input.options.length; i++) {
        const opt = input.options[i];
        const created = await tx.checklistQuestionOption.create({
          data: { questionId: question.id, label: opt.label, value: opt.value, order: i + 1 },
        });
        if (input.rule && opt.value === input.rule.triggerValue) triggerOptionId = created.id;
      }
    }

    if (input.rule) {
      await tx.questionRule.create({
        data: {
          questionId: question.id,
          triggerValue: input.rule.triggerValue,
          triggerOptionId,
          isCritical: input.rule.isCritical,
          requiresComment: input.rule.requiresComment,
          requiresPhoto: input.rule.requiresPhoto,
          createsNonconformity: input.rule.createsNonconformity,
          blocksEquipment: input.rule.blocksEquipment,
          newEquipmentStatus: input.rule.newEquipmentStatus,
          severity: input.rule.severity,
          faultCategoryId: input.rule.faultCategoryId,
        },
      });
    }

    return question;
  });
}

export async function removeQuestion(user: CurrentUser, questionId: string) {
  requirePermission(user, PERMISSIONS.CHECKLIST_TEMPLATE_MANAGE);
  const question = await db.checklistQuestion.findUniqueOrThrow({ where: { id: questionId } });
  await getDraftVersionOrThrow(question.versionId);

  await db.$transaction(async (tx) => {
    await tx.questionRule.deleteMany({ where: { questionId } });
    await tx.checklistQuestionOption.deleteMany({ where: { questionId } });
    await tx.checklistQuestion.delete({ where: { id: questionId } });
  });
}

export async function assignTemplateToEquipments(
  user: CurrentUser,
  templateId: string,
  equipmentIds: string[],
) {
  requirePermission(user, PERMISSIONS.CHECKLIST_TEMPLATE_MANAGE);

  await db.$transaction(async (tx) => {
    for (const equipmentId of equipmentIds) {
      await tx.equipmentChecklistAssignment.upsert({
        where: { equipmentId_templateId: { equipmentId, templateId } },
        update: { active: true },
        create: { equipmentId, templateId },
      });
    }
  });
}
