import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import * as userService from "@/server/services/user.service";
import { applyJobFunctionKit } from "@/server/services/epi.service";
import { generateLoginEmail, generatePassword, DEFAULT_INITIAL_PASSWORD } from "@/domain/shared/credentials";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission, hasPermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS, ROLE_KEYS } from "@/domain/shared/permissions";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

export type CollaboratorInput = {
  name: string;
  matricula?: string | null;
  functionId?: string | null;
  cpf?: string | null;
  ctps?: string | null;
  ctpsSerie?: string | null;
  admissionDate?: Date | null;
  areaId?: string | null;
  turnoId?: string | null;
  phone?: string | null;
  checklistEnabled?: boolean;
};

/** `cargo` (texto exibido/pesquisado nas listagens já existentes) espelha o nome da função. */
async function resolveCargo(tx: Tx, functionId: string | null | undefined): Promise<string | null> {
  if (!functionId) return null;
  const jobFunction = await tx.jobFunction.findUniqueOrThrow({ where: { id: functionId } });
  return jobFunction.name;
}

/** Listagem pra tela de RH — inclui salário, por isso exige HR_MANAGE em vez de COLLABORATOR_MANAGE. */
/** Tela única de Colaboradores (Segurança + RH unificadas): exige COLLABORATOR_MANAGE ou
 * HR_MANAGE pra ver a lista — cada um enxerga as próprias colunas/ações (cadastro geral vs.
 * dados de RH). `salary`/`pis` são zerados aqui mesmo, no servidor, pra quem não tem HR_MANAGE
 * nunca receber esses campos no payload — não depende de a UI simplesmente não exibi-los. */
export async function listCollaboratorsUnified(
  user: CurrentUser,
  filters: { onlyActive?: boolean; search?: string } = {},
) {
  const canManage = hasPermission(user, PERMISSIONS.COLLABORATOR_MANAGE);
  const canSeeHr = hasPermission(user, PERMISSIONS.HR_MANAGE);
  if (!canManage && !canSeeHr) throw new ForbiddenError();

  const collaborators = await db.collaborator.findMany({
    where: {
      active: filters.onlyActive ? true : undefined,
      OR: filters.search
        ? [
            { name: { contains: filters.search } },
            { matricula: { contains: filters.search } },
            { cpf: { contains: filters.search } },
          ]
        : undefined,
    },
    include: { area: { include: { unit: true } }, turno: true, user: true, function: true },
    orderBy: { name: "asc" },
  });

  if (canSeeHr) return collaborators;
  return collaborators.map((c) => ({ ...c, salary: null, pis: null }));
}

/** Resumo leve pro briefing diário do Rico — não é a listagem completa, só os dois números que
 * importam pra quem cuida de RH: quantos colaboradores existem e quantos ainda não têm salário lançado. */
export async function getHrDailyStats(user: CurrentUser) {
  requirePermission(user, PERMISSIONS.HR_MANAGE);
  const [totalColaboradores, semSalarioDefinido] = await Promise.all([
    db.collaborator.count({ where: { active: true } }),
    db.collaborator.count({ where: { active: true, salary: null } }),
  ]);
  return { totalColaboradores, semSalarioDefinido };
}

/** Só quem tem HR_MANAGE define/altera salário — separado de updateCollaborator (COLLABORATOR_MANAGE)
 * de propósito, pra que gestores de área possam editar cadastro sem enxergar ou mexer em folha. */
export async function setCollaboratorSalary(user: CurrentUser, id: string, salary: number | null) {
  requirePermission(user, PERMISSIONS.HR_MANAGE);
  const before = await db.collaborator.findUniqueOrThrow({ where: { id } });
  const collaborator = await db.collaborator.update({ where: { id }, data: { salary } });
  await recordAudit({
    userId: user.id,
    action: "UPDATE",
    entityType: "Collaborator",
    entityId: id,
    previousValue: { salary: before.salary ? Number(before.salary) : null },
    newValue: { salary },
  });
  return collaborator;
}

/** Classificação manual de quem é cobrado por checklist no relatório de ponto — separada de
 * `checklistEnabled` (que só controla se existe um User provisionado pra fazer checklist),
 * porque a lista de quem "precisa" é definida por RH/Supervisão e pode incluir gente que ainda
 * não tem acesso ao sistema (aí o relatório aponta a falta de acesso como o próprio problema). */
export async function setCollaboratorRequiresChecklist(user: CurrentUser, id: string, requiresChecklist: boolean) {
  requirePermission(user, PERMISSIONS.HR_MANAGE);
  const before = await db.collaborator.findUniqueOrThrow({ where: { id } });
  const collaborator = await db.collaborator.update({ where: { id }, data: { requiresChecklist } });
  await recordAudit({
    userId: user.id,
    action: "UPDATE",
    entityType: "Collaborator",
    entityId: id,
    previousValue: { requiresChecklist: before.requiresChecklist },
    newValue: { requiresChecklist },
  });
  return collaborator;
}

/** Colaboradores ativos pro seletor do "Relatório por colaborador" em Indicadores (abas Checklist
 * e Produtividade) — sem exigir `checklistEnabled`/`userId` como o cálculo interno de conformidade
 * de checklist exige, porque o mesmo seletor também alimenta a aba de Produtividade, que não
 * depende de acesso ao sistema (lançamento pode ser feito por quem gerencia, em nome do
 * colaborador). Cobre qualquer colaborador cadastrado em RH, não só o subconjunto técnico
 * habilitado pra checklist. */
export function listActiveCollaboratorsForSupervision(user: CurrentUser) {
  if (!hasPermission(user, PERMISSIONS.CHECKLIST_COMPLIANCE_VIEW) && !hasPermission(user, PERMISSIONS.PRODUCTIVITY_MANAGE)) {
    throw new ForbiddenError();
  }
  return db.collaborator.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
}

export function listCollaboratorsForUser(
  user: CurrentUser,
  filters: { areaId?: string; search?: string; onlyActive?: boolean } = {},
) {
  requirePermission(user, PERMISSIONS.COLLABORATOR_MANAGE);
  return db.collaborator.findMany({
    where: {
      active: filters.onlyActive ? true : undefined,
      areaId: filters.areaId || undefined,
      OR: filters.search
        ? [
            { name: { contains: filters.search } },
            { matricula: { contains: filters.search } },
            { cargo: { contains: filters.search } },
          ]
        : undefined,
    },
    include: { area: { include: { unit: true } }, turno: true, user: true },
    orderBy: { name: "asc" },
  });
}

export async function getCollaboratorDetail(user: CurrentUser, id: string) {
  const canManage = hasPermission(user, PERMISSIONS.COLLABORATOR_MANAGE);
  const canSeeHr = hasPermission(user, PERMISSIONS.HR_MANAGE);
  if (!canManage && !canSeeHr) throw new ForbiddenError();

  const collaborator = await db.collaborator.findUniqueOrThrow({
    where: { id },
    include: {
      area: { include: { unit: true } },
      turno: { include: { scheduleType: true } },
      user: true,
      function: true,
    },
  });

  return canSeeHr ? collaborator : { ...collaborator, salary: null, pis: null };
}

/** Prontuário do colaborador: dados + histórico unificado (acidentes + qualificações), sem tabela de eventos própria. */
export async function getCollaboratorProntuario(user: CurrentUser, id: string) {
  const collaborator = await getCollaboratorDetail(user, id);

  const [involvements, qualifications] = await Promise.all([
    db.accidentInvolvement.findMany({
      where: { collaboratorId: id },
      include: { accident: true },
    }),
    db.qualificationRecord.findMany({
      where: { collaboratorId: id },
      include: { qualificationType: true },
      orderBy: { completedDate: "desc" },
    }),
  ]);

  type HistoryEntry =
    | { kind: "ACIDENTE"; date: Date; involvement: (typeof involvements)[number] }
    | { kind: "QUALIFICACAO"; date: Date; record: (typeof qualifications)[number] };

  const history: HistoryEntry[] = [
    ...involvements.map((involvement) => ({
      kind: "ACIDENTE" as const,
      date: involvement.accident.date,
      involvement,
    })),
    ...qualifications.map((record) => ({
      kind: "QUALIFICACAO" as const,
      date: record.completedDate,
      record,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return { collaborator, involvements, qualifications, history };
}

export function getCollaboratorPhoto(collaboratorId: string) {
  return db.attachment.findFirst({
    where: { collaboratorId, context: "COLABORADOR" },
    orderBy: { uploadedAt: "desc" },
  });
}

/** Anexa/substitui a foto de perfil do colaborador (mesmo padrão da foto de equipamento). */
export async function attachCollaboratorPhoto(
  user: CurrentUser,
  collaboratorId: string,
  file: { filename: string; path: string; mimeType: string; size: number },
) {
  requirePermission(user, PERMISSIONS.COLLABORATOR_MANAGE);
  await db.collaborator.findUniqueOrThrow({ where: { id: collaboratorId } });

  return db.attachment.create({
    data: {
      filename: file.filename,
      path: file.path,
      mimeType: file.mimeType,
      size: file.size,
      context: "COLABORADOR",
      collaboratorId,
      uploadedById: user.id,
    },
  });
}

export async function createCollaborator(user: CurrentUser, data: CollaboratorInput) {
  requirePermission(user, PERMISSIONS.COLLABORATOR_MANAGE);

  const collaborator = await db.$transaction(async (tx) => {
    const cargo = await resolveCargo(tx, data.functionId);
    const created = await tx.collaborator.create({ data: { ...data, cargo } });
    if (data.functionId) {
      await applyJobFunctionKit(tx, {
        collaboratorId: created.id,
        jobFunctionId: data.functionId,
        deliveredAt: data.admissionDate ?? new Date(),
        createdById: user.id,
      });
    }
    await recordAudit(
      { userId: user.id, action: "CREATE", entityType: "Collaborator", entityId: created.id, newValue: data },
      tx,
    );
    return created;
  });

  return collaborator;
}

export async function updateCollaborator(user: CurrentUser, id: string, data: CollaboratorInput) {
  requirePermission(user, PERMISSIONS.COLLABORATOR_MANAGE);
  const before = await db.collaborator.findUniqueOrThrow({ where: { id } });

  const collaborator = await db.$transaction(async (tx) => {
    const cargo = await resolveCargo(tx, data.functionId);
    const updated = await tx.collaborator.update({ where: { id }, data: { ...data, cargo } });
    if (data.functionId) {
      await applyJobFunctionKit(tx, {
        collaboratorId: id,
        jobFunctionId: data.functionId,
        deliveredAt: data.admissionDate ?? new Date(),
        createdById: user.id,
      });
    }
    await recordAudit(
      {
        userId: user.id,
        action: "UPDATE",
        entityType: "Collaborator",
        entityId: id,
        previousValue: before,
        newValue: data,
      },
      tx,
    );
    return updated;
  });

  return collaborator;
}

export async function setCollaboratorActive(user: CurrentUser, id: string, active: boolean) {
  requirePermission(user, PERMISSIONS.COLLABORATOR_MANAGE);
  const before = await db.collaborator.findUniqueOrThrow({ where: { id } });
  const collaborator = await db.collaborator.update({
    where: { id },
    data: { active, inactivatedAt: active ? null : new Date() },
  });
  await recordAudit({
    userId: user.id,
    action: active ? "UPDATE" : "CANCEL",
    entityType: "Collaborator",
    entityId: id,
    previousValue: { active: before.active },
    newValue: { active },
  });
  return collaborator;
}

/**
 * Cria um usuário de login pro colaborador (e-mail/senha gerados) e vincula o colaborador a
 * ele — pra que ele consiga entrar no app e fazer checklist da própria área. A senha só existe
 * em texto plano neste retorno; depois disso só o hash fica gravado (mesmo comportamento de
 * `userService.createUser`).
 */
export async function provisionCollaboratorAccess(admin: CurrentUser, collaboratorId: string) {
  requirePermission(admin, PERMISSIONS.COLLABORATOR_MANAGE);
  const collaborator = await db.collaborator.findUniqueOrThrow({ where: { id: collaboratorId } });
  if (collaborator.userId) {
    throw new Error("Este colaborador já tem acesso ao sistema.");
  }

  const [role, existingUsers] = await Promise.all([
    db.role.findUniqueOrThrow({ where: { key: ROLE_KEYS.COLABORADOR } }),
    db.user.findMany({ select: { email: true } }),
  ]);

  const email = generateLoginEmail(collaborator.name, new Set(existingUsers.map((u) => u.email)));
  const password = DEFAULT_INITIAL_PASSWORD;

  const createdUser = await userService.createUserRecord(admin.id, {
    name: collaborator.name,
    email,
    password,
    roleId: role.id,
    unitId: null,
    areaIds: collaborator.areaId ? [collaborator.areaId] : [],
  });

  await db.collaborator.update({ where: { id: collaboratorId }, data: { userId: createdUser.id } });
  await recordAudit({
    userId: admin.id,
    action: "CREATE",
    entityType: "Collaborator",
    entityId: collaboratorId,
    newValue: { userProvisioned: email },
  });

  return { email, password };
}

/**
 * Cria acesso pra todos os colaboradores ativos que ainda não têm (`userId` nulo) — mesmo
 * provisionamento de `provisionCollaboratorAccess`, só em lote. A senha é a mesma pra todos
 * (`DEFAULT_INITIAL_PASSWORD`), então não precisa reexibir por linha, só o e-mail gerado.
 * Idempotente: rodar de novo só provisiona quem ainda não tinha acesso.
 */
export async function provisionAllCollaboratorsAccess(admin: CurrentUser) {
  requirePermission(admin, PERMISSIONS.COLLABORATOR_MANAGE);

  const [role, collaborators, existingUsers] = await Promise.all([
    db.role.findUniqueOrThrow({ where: { key: ROLE_KEYS.COLABORADOR } }),
    db.collaborator.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.user.findMany({ select: { email: true } }),
  ]);

  const existingEmails = new Set(existingUsers.map((u) => u.email));
  const toProvision = collaborators.filter((c) => !c.userId);
  const created: { name: string; email: string }[] = [];

  for (const collaborator of toProvision) {
    const email = generateLoginEmail(collaborator.name, existingEmails);
    existingEmails.add(email);

    const createdUser = await userService.createUserRecord(admin.id, {
      name: collaborator.name,
      email,
      password: DEFAULT_INITIAL_PASSWORD,
      roleId: role.id,
      unitId: null,
      areaIds: collaborator.areaId ? [collaborator.areaId] : [],
    });
    await db.collaborator.update({ where: { id: collaborator.id }, data: { userId: createdUser.id } });
    created.push({ name: collaborator.name, email });
  }

  if (created.length > 0) {
    await recordAudit({
      userId: admin.id,
      action: "CREATE",
      entityType: "Collaborator",
      entityId: "bulk",
      newValue: { bulkProvisioned: created.length },
    });
  }

  return { created, alreadyLinked: collaborators.length - toProvision.length };
}

/** Gera uma nova senha pro usuário já vinculado ao colaborador e a retorna em texto plano (uma única vez). */
export async function resetCollaboratorAccessPassword(admin: CurrentUser, collaboratorId: string) {
  requirePermission(admin, PERMISSIONS.COLLABORATOR_MANAGE);
  const collaborator = await db.collaborator.findUniqueOrThrow({ where: { id: collaboratorId } });
  if (!collaborator.userId) {
    throw new Error("Este colaborador ainda não tem acesso ao sistema.");
  }

  const password = generatePassword();
  await userService.resetUserPasswordRecord(admin.id, collaborator.userId, password);
  const user = await db.user.findUniqueOrThrow({ where: { id: collaborator.userId } });

  return { email: user.email, password };
}
