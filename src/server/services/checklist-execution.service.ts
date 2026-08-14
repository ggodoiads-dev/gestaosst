import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import { recordEquipmentEvent } from "@/server/services/equipment-events";
import { nextFriendlyCode } from "@/server/services/sequence";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission, requireAreaAccess, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { evaluateChecklist, type AnswerInput, type QuestionInput } from "@/domain/checklist/rule-engine";
import { getScheduledTimeForDate, computeDelayMinutes, isLate } from "@/domain/checklist/scheduling";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Equipamentos com checklist aplicável, visíveis ao usuário, com a situação
 * do dia calculada (previsto/pendente/em andamento/realizado/atrasado) —
 * seções 25-28 do documento.
 */
export async function listChecklistBoardForUser(user: CurrentUser, filters: { areaId?: string } = {}) {
  requirePermission(user, PERMISSIONS.CHECKLIST_EXECUTE);
  if (filters.areaId) {
    requireAreaAccess(user, filters.areaId, PERMISSIONS.EQUIPMENT_VIEW_ALL_AREAS);
  }
  const canSeeAll = user.permissions.has(PERMISSIONS.EQUIPMENT_VIEW_ALL_AREAS);
  const allowedAreaIds = canSeeAll ? undefined : Array.from(user.areaIds);

  const equipments = await db.equipment.findMany({
    where: {
      active: true,
      areaId: filters.areaId ? filters.areaId : allowedAreaIds ? { in: allowedAreaIds } : undefined,
      assignments: { some: { active: true } },
    },
    include: {
      area: true,
      type: true,
      assignments: {
        where: { active: true },
        include: {
          template: {
            include: { versions: { where: { status: "ATIVA" }, take: 1 } },
          },
        },
      },
      schedules: { where: { active: true } },
    },
    orderBy: { code: "asc" },
  });

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const board = [];
  for (const equipment of equipments) {
    const assignment = equipment.assignments[0];
    const version = assignment?.template.versions[0];
    if (!version) continue;

    const schedule = equipment.schedules.find((s) => s.templateId === assignment.templateId);
    const scheduledFor = schedule ? getScheduledTimeForDate(schedule, now) : null;

    const [inProgress, completedToday] = await Promise.all([
      db.checklistExecution.findFirst({
        where: { equipmentId: equipment.id, checklistVersionId: version.id, status: "EM_ANDAMENTO" },
      }),
      db.checklistExecution.findFirst({
        where: {
          equipmentId: equipment.id,
          checklistVersionId: version.id,
          status: "CONCLUIDO",
          finishedAt: { gte: startOfDay },
        },
        orderBy: { finishedAt: "desc" },
      }),
    ]);

    let situation: "REALIZADO" | "EM_ANDAMENTO" | "ATRASADO" | "PENDENTE" = "PENDENTE";
    if (completedToday) situation = "REALIZADO";
    else if (inProgress) situation = "EM_ANDAMENTO";
    else if (isLate(scheduledFor, now)) situation = "ATRASADO";

    board.push({
      equipment,
      templateId: assignment.templateId,
      templateName: assignment.template.name,
      versionId: version.id,
      scheduledFor,
      situation,
      completedAt: completedToday?.finishedAt ?? null,
      inProgressExecutionId: inProgress?.id ?? null,
    });
  }

  return board;
}

export async function getExecutionContext(user: CurrentUser, equipmentId: string) {
  requirePermission(user, PERMISSIONS.CHECKLIST_EXECUTE);

  const equipment = await db.equipment.findUniqueOrThrow({
    where: { id: equipmentId },
    include: { area: true, type: true },
  });
  requireAreaAccess(user, equipment.areaId, PERMISSIONS.EQUIPMENT_VIEW_ALL_AREAS);

  const assignment = await db.equipmentChecklistAssignment.findFirst({
    where: { equipmentId, active: true },
    include: {
      template: {
        include: {
          versions: {
            where: { status: "ATIVA" },
            take: 1,
            include: {
              questions: {
                orderBy: { order: "asc" },
                include: { options: { orderBy: { order: "asc" } }, rules: true },
              },
            },
          },
        },
      },
    },
  });

  const version = assignment?.template.versions[0];
  if (!version) {
    throw new ForbiddenError("Este equipamento não possui um checklist ativo configurado.");
  }

  let execution = await db.checklistExecution.findFirst({
    where: { equipmentId, checklistVersionId: version.id, status: "EM_ANDAMENTO" },
    include: { answers: { include: { attachments: true } } },
  });

  if (!execution) {
    const schedule = await db.checklistSchedule.findFirst({
      where: { equipmentId, templateId: assignment!.templateId, active: true },
    });
    const scheduledFor = schedule ? getScheduledTimeForDate(schedule, new Date()) : null;
    const code = await nextFriendlyCode("checklist_execution", "EXE");

    execution = await db.checklistExecution.create({
      data: {
        code,
        equipmentId,
        checklistVersionId: version.id,
        executedById: user.id,
        scheduledFor,
      },
      include: { answers: { include: { attachments: true } } },
    });
  }

  return { equipment, template: assignment!.template, version, execution };
}

export async function saveAnswer(
  user: CurrentUser,
  executionId: string,
  input: { questionId: string; value: string | null; comment: string | null },
) {
  const execution = await db.checklistExecution.findUniqueOrThrow({ where: { id: executionId } });
  if (execution.status !== "EM_ANDAMENTO") {
    throw new ForbiddenError("Este checklist já foi finalizado e não pode mais ser editado.");
  }

  return db.checklistAnswer.upsert({
    where: { executionId_questionId: { executionId, questionId: input.questionId } },
    update: { value: input.value, comment: input.comment },
    create: {
      executionId,
      questionId: input.questionId,
      value: input.value,
      comment: input.comment,
    },
  });
}

export async function attachAnswerPhoto(
  executionId: string,
  questionId: string,
  file: { filename: string; path: string; mimeType: string; size: number },
  userId: string,
) {
  const answer = await db.checklistAnswer.upsert({
    where: { executionId_questionId: { executionId, questionId } },
    update: {},
    create: { executionId, questionId },
  });

  return db.attachment.create({
    data: {
      filename: file.filename,
      path: file.path,
      mimeType: file.mimeType,
      size: file.size,
      context: "RESPOSTA_CHECKLIST",
      checklistAnswerId: answer.id,
      uploadedById: userId,
    },
  });
}

export type FinalizeResult =
  | { ok: true }
  | { ok: false; issues: { questionId: string; questionTitle: string; reason: string }[] };

const REASON_LABELS: Record<string, string> = {
  RESPOSTA_OBRIGATORIA: "Resposta obrigatória",
  COMENTARIO_OBRIGATORIO: "Comentário obrigatório para esta resposta",
  FOTO_OBRIGATORIA: "Foto obrigatória para esta resposta",
};

export async function finalizeExecution(
  user: CurrentUser,
  executionId: string,
  clientAnswers: { questionId: string; value: string | null; comment: string | null }[] = [],
): Promise<FinalizeResult> {
  const executionCheck = await db.checklistExecution.findUniqueOrThrow({ where: { id: executionId } });
  if (executionCheck.status !== "EM_ANDAMENTO") {
    throw new ForbiddenError("Este checklist já foi finalizado.");
  }

  /**
   * As respostas ficam no estado do cliente durante o preenchimento; o
   * salvamento por pergunta (saveAnswer) é best-effort para permitir
   * retomar depois, mas não pode ser a fonte de verdade da finalização —
   * uma requisição em trânsito perdida no caminho não pode fazer o
   * colaborador perder uma resposta que ele visivelmente já preencheu.
   * Por isso a finalização recebe e persiste o estado completo do cliente
   * antes de validar/avaliar.
   */
  for (const answer of clientAnswers) {
    if (answer.value === null && answer.comment === null) continue;
    await db.checklistAnswer.upsert({
      where: { executionId_questionId: { executionId, questionId: answer.questionId } },
      update: { value: answer.value, comment: answer.comment },
      create: { executionId, questionId: answer.questionId, value: answer.value, comment: answer.comment },
    });
  }

  const execution = await db.checklistExecution.findUniqueOrThrow({
    where: { id: executionId },
    include: {
      equipment: true,
      checklistVersion: { include: { questions: { include: { options: true, rules: true } } } },
      answers: { include: { attachments: true } },
    },
  });

  const questions: QuestionInput[] = execution.checklistVersion.questions.map((q) => ({
    id: q.id,
    required: q.required,
    allowNotApplicable: q.allowNotApplicable,
    rules: q.rules.map((r) => ({
      id: r.id,
      questionId: r.questionId,
      triggerValue: r.triggerValue,
      isCritical: r.isCritical,
      requiresComment: r.requiresComment,
      requiresPhoto: r.requiresPhoto,
      createsNonconformity: r.createsNonconformity,
      blocksEquipment: r.blocksEquipment,
      newEquipmentStatus: r.newEquipmentStatus,
      severity: r.severity,
      faultCategoryId: r.faultCategoryId,
    })),
  }));

  const answers: AnswerInput[] = execution.answers.map((a) => ({
    questionId: a.questionId,
    value: a.value,
    comment: a.comment,
    hasPhoto: a.attachments.length > 0,
  }));

  const evaluation = evaluateChecklist(questions, answers);

  if (!evaluation.valid) {
    const questionMap = new Map(execution.checklistVersion.questions.map((q) => [q.id, q.title]));
    return {
      ok: false,
      issues: evaluation.issues.map((i) => ({
        questionId: i.questionId,
        questionTitle: questionMap.get(i.questionId) ?? "",
        reason: REASON_LABELS[i.reason] ?? i.reason,
      })),
    };
  }

  const finishedAt = new Date();
  const delayMinutes = computeDelayMinutes(execution.scheduledFor, finishedAt);
  const previousStatus = execution.equipment.status;

  await db.$transaction(async (tx) => {
    await tx.checklistExecution.update({
      where: { id: executionId },
      data: { status: "CONCLUIDO", result: evaluation.result, finishedAt, delayMinutes },
    });

    await recordEquipmentEvent(
      {
        equipmentId: execution.equipmentId,
        type: "CHECKLIST_REALIZADO",
        description: `Checklist ${execution.code} realizado — resultado: ${evaluation.result}.`,
        userId: user.id,
        executionId,
      },
      tx,
    );

    for (const deviation of evaluation.triggeredDeviations) {
      await recordEquipmentEvent(
        {
          equipmentId: execution.equipmentId,
          type: "DESVIO_IDENTIFICADO",
          description: "Desvio identificado durante o checklist.",
          userId: user.id,
          executionId,
        },
        tx,
      );

      if (deviation.rule.createsNonconformity) {
        const answer = execution.answers.find((a) => a.questionId === deviation.questionId);
        const ncCode = await nextFriendlyCode("nonconformity", "NC", 6, tx);
        const nc = await tx.nonconformity.create({
          data: {
            code: ncCode,
            equipmentId: execution.equipmentId,
            areaId: execution.equipment.areaId,
            originExecutionId: executionId,
            originAnswerId: answer?.id,
            identifiedById: user.id,
            description: answer?.comment || "Desvio identificado automaticamente pelo checklist.",
            severity: deviation.rule.severity ?? "MEDIA",
            faultCategoryId: deviation.rule.faultCategoryId,
          },
        });
        await tx.actionPlan.create({ data: { nonconformityId: nc.id, createdById: user.id } });
        await recordEquipmentEvent(
          {
            equipmentId: execution.equipmentId,
            type: "NC_CRIADA",
            description: `Não conformidade ${nc.code} criada.`,
            userId: user.id,
            nonconformityId: nc.id,
          },
          tx,
        );
      }
    }

    if (evaluation.newEquipmentStatus !== previousStatus) {
      await tx.equipment.update({
        where: { id: execution.equipmentId },
        data: { status: evaluation.newEquipmentStatus },
      });

      if (evaluation.newEquipmentStatus === "BLOQUEADO") {
        await recordEquipmentEvent(
          {
            equipmentId: execution.equipmentId,
            type: "EQUIPAMENTO_BLOQUEADO",
            description: "Equipamento bloqueado automaticamente após desvio crítico.",
            userId: user.id,
            executionId,
          },
          tx,
        );
      } else if (evaluation.newEquipmentStatus === "RESTRITO") {
        await recordEquipmentEvent(
          {
            equipmentId: execution.equipmentId,
            type: "EQUIPAMENTO_RESTRITO",
            description: "Equipamento restrito após desvio identificado.",
            userId: user.id,
            executionId,
          },
          tx,
        );
      }

      await recordAudit(
        {
          userId: user.id,
          action: "STATUS_CHANGE",
          entityType: "Equipment",
          entityId: execution.equipmentId,
          previousValue: { status: previousStatus },
          newValue: { status: evaluation.newEquipmentStatus },
        },
        tx,
      );
    }

    await recordAudit(
      {
        userId: user.id,
        action: "UPDATE",
        entityType: "ChecklistExecution",
        entityId: executionId,
        newValue: { status: "CONCLUIDO", result: evaluation.result },
      },
      tx,
    );
  });

  return { ok: true };
}

export async function invalidateExecution(user: CurrentUser, executionId: string, reason: string) {
  requirePermission(user, PERMISSIONS.CHECKLIST_INVALIDATE);
  const execution = await db.checklistExecution.findUniqueOrThrow({ where: { id: executionId } });

  await db.$transaction(async (tx) => {
    await tx.checklistExecution.update({
      where: { id: executionId },
      data: {
        status: "INVALIDADO",
        invalidatedById: user.id,
        invalidatedAt: new Date(),
        invalidationReason: reason,
      },
    });
    await recordEquipmentEvent(
      {
        equipmentId: execution.equipmentId,
        type: "CHECKLIST_INVALIDADO",
        description: `Checklist ${execution.code} invalidado: ${reason}`,
        userId: user.id,
        executionId,
      },
      tx,
    );
    await recordAudit(
      {
        userId: user.id,
        action: "INVALIDATE",
        entityType: "ChecklistExecution",
        entityId: executionId,
        newValue: { reason },
      },
      tx,
    );
  });
}

export function searchExecutionHistory(
  user: CurrentUser,
  filters: { areaId?: string; status?: string; search?: string } = {},
) {
  requirePermission(user, PERMISSIONS.HISTORY_VIEW);
  const canSeeAll = user.permissions.has(PERMISSIONS.EQUIPMENT_VIEW_ALL_AREAS);

  return db.checklistExecution.findMany({
    where: {
      status: (filters.status as never) || undefined,
      equipment: {
        areaId: canSeeAll ? filters.areaId : { in: filters.areaId ? [filters.areaId] : Array.from(user.areaIds) },
        OR: filters.search
          ? [{ code: { contains: filters.search } }, { name: { contains: filters.search } }]
          : undefined,
      },
    },
    include: { equipment: { include: { area: true } }, executedBy: true },
    orderBy: { startedAt: "desc" },
    take: 200,
  });
}

export function listMyExecutions(user: CurrentUser, take = 50) {
  return db.checklistExecution.findMany({
    where: { executedById: user.id },
    include: { equipment: true },
    orderBy: { startedAt: "desc" },
    take,
  });
}

export type ExecutionWithContext = Prisma.ChecklistExecutionGetPayload<{
  include: { equipment: true };
}>;
