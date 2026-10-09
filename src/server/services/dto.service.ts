import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission, hasPermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { formatInTimeZone } from "date-fns-tz";
import { APP_TIMEZONE } from "@/lib/dates";
import { normalizeText, parseDtoWorkbook, type DtoAnswer, type DtoRawRow } from "@/domain/dto/parse";
import {
  DTO_ACTIONS_WINDOW_DAYS,
  DTO_COOLDOWN_DAYS,
  DTO_INCIDENT_TYPES,
  DTO_INCIDENT_WINDOW_DAYS,
  DTO_JUSTIFICATION_REASON,
  DTO_NEW_HIRE_DAYS,
  daysSinceDate,
  dtoCooldown,
  hasPendingIncident,
  tenureDays,
} from "@/domain/dto/suggestions";
import { classifyAnswer } from "@/domain/dto/answers";
import { syncDtoActionRows } from "@/server/services/dto-action.service";
import { generateDtoActions, type DtoActionSuggestionItem } from "@/server/services/rico.service";

/** Ver os DTOs: quem gerencia OU quem só pode visualizar (Auditor). Importar exige `DTO_MANAGE`. */
function requireDtoView(user: CurrentUser): void {
  if (!hasPermission(user, PERMISSIONS.DTO_MANAGE) && !hasPermission(user, PERMISSIONS.DTO_VIEW)) throw new ForbiddenError();
}

export type DtoItem = {
  id: string;
  collaboratorId: string;
  collaboratorName: string;
  date: Date;
  activity: string;
  evaluatorName: string | null;
  evaluatorRole: string | null;
  leaderName: string | null;
  operation: string | null;
  yesCount: number;
  noCount: number;
  naCount: number;
  scorePercent: number | null;
  answers: DtoAnswer[];
};

type DtoRow = Awaited<ReturnType<typeof db.dtoEvaluation.findMany>>[number];

function toItem(row: DtoRow, collaboratorName: string): DtoItem {
  return {
    id: row.id,
    collaboratorId: row.collaboratorId,
    collaboratorName,
    date: row.date,
    activity: row.activity,
    evaluatorName: row.evaluatorName,
    evaluatorRole: row.evaluatorRole,
    leaderName: row.leaderName,
    operation: row.operation,
    yesCount: row.yesCount,
    noCount: row.noCount,
    naCount: row.naCount,
    scorePercent: row.scorePercent,
    answers: (row.answers as DtoAnswer[]) ?? [],
  };
}

function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}

/** Mês (AAAA-MM) da avaliação mais recente — pra a tela abrir onde há dado, não num mês vazio. */
export async function latestDtoMonth(user: CurrentUser): Promise<string | null> {
  requireDtoView(user);
  const latest = await db.dtoEvaluation.findFirst({ orderBy: { date: "desc" }, select: { date: true } });
  if (!latest) return null;
  return `${latest.date.getUTCFullYear()}-${String(latest.date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function listDtoOfMonth(user: CurrentUser, month: string): Promise<DtoItem[]> {
  requireDtoView(user);
  const { start, end } = monthRange(month);
  const rows = await db.dtoEvaluation.findMany({
    where: { date: { gte: start, lt: end } },
    include: { collaborator: { select: { name: true } } },
    orderBy: { date: "desc" },
  });
  return rows.map((r) => toItem(r, r.collaborator.name));
}

/** Os DTOs feitos COM o próprio colaborador logado, com as respostas. */
export async function listMyDtos(user: CurrentUser): Promise<DtoItem[]> {
  const own = await db.collaborator.findUnique({ where: { userId: user.id }, select: { id: true, name: true } });
  if (!own) return [];
  const rows = await db.dtoEvaluation.findMany({ where: { collaboratorId: own.id }, orderBy: { date: "desc" } });
  return rows.map((r) => toItem(r, own.name));
}

export type DtoImportRow = DtoRawRow & {
  collaboratorId: string | null;
  collaboratorName: string | null;
  action: "create" | "skip-duplicate" | "skip-not-in-sigo" | "skip-ambiguous";
};

export function parseDtoSpreadsheet(buffer: Buffer): DtoRawRow[] {
  return parseDtoWorkbook(buffer);
}

/** Casa o AVALIADO com um colaborador do SIGO pelo nome. Quem não existe no SIGO fica de fora; nome repetido
 * (mais de um colaborador com o mesmo nome) também não é importado pra não atribuir o DTO à pessoa errada.
 * O avaliador (liderança) não é casado: fica só como texto, e continua salvo se ele sair da empresa. */
export async function buildDtoImportPreview(user: CurrentUser, rawRows: DtoRawRow[]): Promise<DtoImportRow[]> {
  requirePermission(user, PERMISSIONS.DTO_MANAGE);

  const [collaborators, existing] = await Promise.all([
    db.collaborator.findMany({ select: { id: true, name: true } }),
    db.dtoEvaluation.findMany({ where: { externalKey: { in: rawRows.map((r) => r.externalKey) } }, select: { externalKey: true } }),
  ]);
  const byName = new Map<string, { id: string; name: string }[]>();
  for (const c of collaborators) {
    const key = normalizeText(c.name);
    byName.set(key, [...(byName.get(key) ?? []), c]);
  }
  const existingKeys = new Set(existing.map((e) => e.externalKey));

  return rawRows.map((row) => {
    const matches = byName.get(normalizeText(row.evaluatedName)) ?? [];
    let action: DtoImportRow["action"] = "create";
    if (existingKeys.has(row.externalKey)) action = "skip-duplicate";
    else if (matches.length === 0) action = "skip-not-in-sigo";
    else if (matches.length > 1) action = "skip-ambiguous";
    const matched = matches.length === 1 ? matches[0] : null;
    return { ...row, collaboratorId: matched?.id ?? null, collaboratorName: matched?.name ?? null, action };
  });
}

/** Grava só as linhas marcadas "create" (confere de novo que o colaborador existe). */
export async function commitDtoImport(
  user: CurrentUser,
  rows: DtoImportRow[],
): Promise<{ created: number; skipped: number; createdIds: string[] }> {
  requirePermission(user, PERMISSIONS.DTO_MANAGE);
  const candidates = rows.filter((r) => r.action === "create" && r.collaboratorId);
  const valid = new Set(
    (await db.collaborator.findMany({ where: { id: { in: candidates.map((r) => r.collaboratorId!) } }, select: { id: true } })).map((c) => c.id),
  );
  const toCreate = candidates.filter((r) => valid.has(r.collaboratorId!));
  if (toCreate.length === 0) return { created: 0, skipped: rows.length, createdIds: [] };

  const result = await db.dtoEvaluation.createMany({
    data: toCreate.map((r) => ({
      externalKey: r.externalKey,
      collaboratorId: r.collaboratorId!,
      date: new Date(r.date),
      evaluatedName: r.evaluatedName,
      evaluatedRole: r.evaluatedRole,
      evaluatorName: r.evaluatorName,
      evaluatorRole: r.evaluatorRole,
      leaderName: r.leaderName,
      company: r.company,
      operation: r.operation,
      activity: r.activity,
      answers: r.answers,
      yesCount: r.yesCount,
      noCount: r.noCount,
      naCount: r.naCount,
      scorePercent: r.scorePercent,
      importedById: user.id,
    })),
    skipDuplicates: true,
  });
  await recordAudit({
    userId: user.id,
    action: "CREATE",
    entityType: "DtoImport",
    entityId: crypto.randomUUID(),
    newValue: { created: result.count, total: rows.length },
  });
  const createdIds = (
    await db.dtoEvaluation.findMany({ where: { externalKey: { in: toCreate.map((r) => r.externalKey) } }, select: { id: true } })
  ).map((d) => d.id);
  return { created: result.count, skipped: rows.length - result.count, createdIds };
}

export type DtoSuggestion = {
  collaboratorId: string;
  name: string;
  areaName: string | null;
  functionName: string | null;
  admissionDate: Date | null;
  lastDtoDate: Date | null;
  lastDtoActivity: string | null;
  justification: { id: string; date: Date; note: string | null; reason: string } | null;
  /** Último DTO ou justificativa — a data que conta pra carência. */
  lastEffectiveDate: Date | null;
  daysSince: number | null;
  eligible: boolean;
  eligibleOn: Date | null;
  tenureDays: number | null;
  /** Menos de 60 dias de casa: prioridade pro primeiro DTO. */
  isNewHire: boolean;
  /** Incidente que ainda espera DTO (libera mesmo dentro dos 60 dias). */
  pendingIncident: { date: Date; code: string } | null;
};

/** Sugestões de DTO: colaboradores ativos no SIGO, do mais tempo sem DTO pro menos. Quem nunca foi avaliado vem
 * primeiro. Quem teve um DTO (ou uma justificativa) há menos de 60 dias está em carência: não é sugerido ainda. */
export async function getDtoSuggestions(user: CurrentUser) {
  requireDtoView(user);
  const todayKey = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");

  const [y, m, d] = todayKey.split("-").map(Number);
  const incidentFrom = new Date(Date.UTC(y, m - 1, d - DTO_INCIDENT_WINDOW_DAYS, 0));
  const [collaborators, evaluations, justifications, incidents] = await Promise.all([
    db.collaborator.findMany({
      // ADM/liderança (função marcada como isenta de DTO) não é avaliada, então não é cobrada.
      where: { active: true, OR: [{ functionId: null }, { function: { dtoExempt: false } }] },
      select: {
        id: true,
        name: true,
        admissionDate: true,
        area: { select: { name: true } },
        function: { select: { name: true } },
      },
    }),
    db.dtoEvaluation.findMany({
      orderBy: { date: "desc" },
      select: { collaboratorId: true, date: true, activity: true },
    }),
    // Tabela pode ainda não existir no banco (migração pendente): sem justificativas, a lista segue funcionando.
    db.dtoJustification
      .findMany({ orderBy: { date: "desc" }, select: { id: true, collaboratorId: true, date: true, note: true, reason: true } })
      .catch((error) => {
        console.error("[dto] justificativas indisponíveis:", error);
        return [] as { id: string; collaboratorId: string; date: Date; note: string | null; reason: string }[];
      }),
    // Incidentes recentes com o colaborador como vítima: pedem DTO mesmo dentro dos 60 dias de carência.
    db.accidentInvolvement.findMany({
      where: {
        role: "VITIMA",
        accident: { status: { not: "CANCELADA" }, type: { in: [...DTO_INCIDENT_TYPES] }, date: { gte: incidentFrom } },
      },
      select: { collaboratorId: true, accident: { select: { date: true, code: true } } },
    }),
  ]);
  const lastIncident = new Map<string, { date: Date; code: string }>();
  for (const i of incidents) {
    const current = lastIncident.get(i.collaboratorId);
    if (!current || i.accident.date > current.date) lastIncident.set(i.collaboratorId, i.accident);
  }

  const lastDto = new Map<string, { date: Date; activity: string }>();
  for (const e of evaluations) if (!lastDto.has(e.collaboratorId)) lastDto.set(e.collaboratorId, { date: e.date, activity: e.activity });
  const lastJust = new Map<string, (typeof justifications)[number]>();
  for (const j of justifications) if (!lastJust.has(j.collaboratorId)) lastJust.set(j.collaboratorId, j);

  const items: DtoSuggestion[] = collaborators.map((c) => {
    const dto = lastDto.get(c.id) ?? null;
    const just = lastJust.get(c.id) ?? null;
    const lastEffectiveDate = [dto?.date, just?.date].filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    const cooldown = dtoCooldown(lastEffectiveDate, todayKey);
    const tenure = tenureDays(c.admissionDate, todayKey);
    const incident = lastIncident.get(c.id) ?? null;
    const pendingIncident = incident && hasPendingIncident(lastEffectiveDate, incident.date) ? incident : null;
    return {
      collaboratorId: c.id,
      name: c.name,
      areaName: c.area?.name ?? null,
      functionName: c.function?.name ?? null,
      admissionDate: c.admissionDate,
      lastDtoDate: dto?.date ?? null,
      lastDtoActivity: dto?.activity ?? null,
      // Só mostra a justificativa se ela é o que está segurando a pessoa (é mais recente que o último DTO).
      justification: just && (!dto || just.date >= dto.date) ? just : null,
      lastEffectiveDate,
      daysSince: cooldown.daysSince,
      // Incidente é a única exceção à carência de 60 dias.
      eligible: cooldown.eligible || !!pendingIncident,
      eligibleOn: cooldown.eligibleOn,
      pendingIncident,
      tenureDays: tenure,
      isNewHire: tenure !== null && tenure >= 0 && tenure < DTO_NEW_HIRE_DAYS,
    };
  });

  // Prioridade: 0) pós-incidente; 1) novos (< 60 dias de casa), os mais perto de completar 60 dias primeiro; 2) nunca avaliados (os mais
  // antigos na casa antes); 3) quem está há mais tempo sem DTO.
  items.sort((a, b) => {
    if (!!a.pendingIncident !== !!b.pendingIncident) return a.pendingIncident ? -1 : 1;
    if (a.pendingIncident && b.pendingIncident) return b.pendingIncident.date.getTime() - a.pendingIncident.date.getTime() || a.name.localeCompare(b.name, "pt-BR");
    if (a.isNewHire !== b.isNewHire) return a.isNewHire ? -1 : 1;
    if (a.isNewHire && b.isNewHire) return (b.tenureDays ?? 0) - (a.tenureDays ?? 0) || a.name.localeCompare(b.name, "pt-BR");
    if (a.daysSince === null && b.daysSince !== null) return -1;
    if (b.daysSince === null && a.daysSince !== null) return 1;
    if (a.daysSince === null && b.daysSince === null) {
      return (a.admissionDate?.getTime() ?? Infinity) - (b.admissionDate?.getTime() ?? Infinity) || a.name.localeCompare(b.name, "pt-BR");
    }
    return (b.daysSince ?? 0) - (a.daysSince ?? 0) || a.name.localeCompare(b.name, "pt-BR");
  });

  return { cooldownDays: DTO_COOLDOWN_DAYS, todayKey, items, canJustify: hasPermission(user, PERMISSIONS.DTO_MANAGE) };
}

/** Registra que o colaborador já teve um DTO feito por liderança não monitorada na unidade. Conta como DTO feito
 * na data informada (não pode ser futura) pra regra dos 60 dias. */
export async function justifyDto(user: CurrentUser, input: { collaboratorId: string; dayKey: string; note: string | null }) {
  requirePermission(user, PERMISSIONS.DTO_MANAGE);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dayKey)) throw new Error("Data inválida.");
  const todayKey = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
  if (input.dayKey > todayKey) throw new Error("A data não pode ser no futuro.");
  const [y, m, d] = input.dayKey.split("-").map(Number);

  const collaborator = await db.collaborator.findUniqueOrThrow({ where: { id: input.collaboratorId }, select: { id: true } });
  const created = await db.dtoJustification.create({
    data: {
      collaboratorId: collaborator.id,
      date: new Date(Date.UTC(y, m - 1, d, 12)),
      reason: DTO_JUSTIFICATION_REASON,
      note: input.note?.trim() || null,
      createdById: user.id,
    },
  });
  await recordAudit({
    userId: user.id,
    action: "CREATE",
    entityType: "DtoJustification",
    entityId: created.id,
    newValue: { collaboratorId: collaborator.id, dayKey: input.dayKey, reason: DTO_JUSTIFICATION_REASON, note: input.note },
  });
}

export async function removeDtoJustification(user: CurrentUser, id: string) {
  requirePermission(user, PERMISSIONS.DTO_MANAGE);
  const existing = await db.dtoJustification.findUniqueOrThrow({ where: { id } });
  await db.dtoJustification.delete({ where: { id } });
  await recordAudit({
    userId: user.id,
    action: "DELETE",
    entityType: "DtoJustification",
    entityId: id,
    previousValue: { collaboratorId: existing.collaboratorId, date: existing.date, reason: existing.reason, note: existing.note },
  });
}

export type DtoActionsResult = { actions: DtoActionSuggestionItem[]; generatedAt: Date | null; cached: boolean };

/** Gera (ou lê do cache) as ações do Rico de um DTO e garante que elas existam no Plano de Ações. Sem checagem de
 * acesso: quem chama já decidiu que pode (tela do DTO ou importação). */
function isRecentDto(date: Date): boolean {
  const todayKey = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
  return daysSinceDate(date, todayKey) <= DTO_ACTIONS_WINDOW_DAYS;
}

async function ensureDtoActions(dtoId: string, regenerate: boolean): Promise<DtoActionsResult> {
  const dto = await db.dtoEvaluation.findUniqueOrThrow({ where: { id: dtoId } });

  if (!regenerate) {
    const cached = await db.dtoActionSuggestion.findUnique({ where: { dtoEvaluationId: dtoId } }).catch(() => null);
    if (cached) {
      const cachedActions = cached.actions as DtoActionSuggestionItem[];
      if (isRecentDto(dto.date)) await syncDtoActionRows(dtoId, cachedActions); // cobre sugestões geradas antes do Plano de Ações existir
      return { actions: cachedActions, generatedAt: cached.generatedAt, cached: true };
    }
  }

  const answers = (dto.answers as DtoAnswer[]) ?? [];
  const negatives = answers.filter((a) => classifyAnswer(a.a) === "no").map((a) => a.q);
  const observations = answers.filter((a) => classifyAnswer(a.a) === "text").map((a) => ({ question: a.q, text: a.a }));
  if (negatives.length === 0 && observations.length === 0) return { actions: [], generatedAt: null, cached: false };

  const actions = await generateDtoActions({
    activity: dto.activity,
    evaluatedRole: dto.evaluatedRole,
    scorePercent: dto.scorePercent,
    negatives,
    observations,
  });
  if (!actions) throw new Error("O Rico não conseguiu gerar as ações agora.");

  const saved = await db.dtoActionSuggestion
    .upsert({
      where: { dtoEvaluationId: dtoId },
      update: { actions, generatedAt: new Date(), model: "gpt-4o" },
      create: { dtoEvaluationId: dtoId, actions, model: "gpt-4o" },
    })
    .catch((error) => {
      console.error("[dto] não foi possível guardar as ações do Rico:", error);
      return null;
    });
  if (isRecentDto(dto.date)) await syncDtoActionRows(dtoId, actions);
  return { actions, generatedAt: saved?.generatedAt ?? new Date(), cached: false };
}

/** Ações sugeridas pelo Rico pra um DTO. A primeira abertura (ou a importação) gera e guarda; as próximas leem do banco
 * (só a gestão pode pedir pra gerar de novo). Quem vê: gestão/Auditor ou o próprio avaliado. */
export async function getDtoActions(user: CurrentUser, dtoId: string, options: { regenerate?: boolean } = {}): Promise<DtoActionsResult> {
  const dto = await db.dtoEvaluation.findUniqueOrThrow({ where: { id: dtoId }, select: { collaboratorId: true } });
  const canSeeAll = hasPermission(user, PERMISSIONS.DTO_MANAGE) || hasPermission(user, PERMISSIONS.DTO_VIEW);
  if (!canSeeAll) {
    const own = await db.collaborator.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (own?.id !== dto.collaboratorId) throw new ForbiddenError();
  }
  return ensureDtoActions(dtoId, !!options.regenerate && hasPermission(user, PERMISSIONS.DTO_MANAGE));
}

/** Depois de uma importação: gera, uma a uma, as ações dos DTOs novos (best-effort, em segundo plano) pra já aparecerem
 * no Plano de Ações sem ninguém precisar abrir cada DTO. */
export async function generateActionsForDtos(dtoIds: string[]): Promise<void> {
  for (const id of dtoIds) {
    try {
      await ensureDtoActions(id, false);
    } catch (error) {
      console.error("[dto] não foi possível gerar as ações do DTO", id, error);
    }
  }
}


/**
 * Põe em dia, sozinho, o plano de ações dos DTOs recentes (últimos 90 dias): gera as ações do Rico dos que têm item "Não"
 * e ainda não foram analisados, e cria no Plano de Ações os itens dos que já têm sugestão mas não têm item. Roda em
 * segundo plano quando alguém abre DTO ou Planos de Ação; faz poucos por vez pra controlar o custo da IA.
 */
export async function generateMissingActions(limit = 12): Promise<void> {
  try {
    const todayKey = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
    const [y, m, d] = todayKey.split("-").map(Number);
    const cutoff = new Date(Date.UTC(y, m - 1, d - DTO_ACTIONS_WINDOW_DAYS, 0));

    const pending = await db.dtoEvaluation.findMany({
      where: {
        date: { gte: cutoff },
        OR: [
          { noCount: { gt: 0 }, actionSuggestion: null },
          { actionSuggestion: { isNot: null }, actions: { none: {} } },
        ],
      },
      select: { id: true },
      orderBy: { date: "desc" },
      take: limit,
    });
    await generateActionsForDtos(pending.map((p) => p.id));
  } catch (error) {
    console.error("[dto] não foi possível pôr em dia as ações dos DTOs:", error);
  }
}
