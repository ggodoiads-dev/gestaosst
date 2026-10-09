import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission, hasPermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { formatInTimeZone } from "date-fns-tz";
import { APP_TIMEZONE } from "@/lib/dates";
import { normalizeText, parseDtoWorkbook, type DtoAnswer, type DtoRawRow } from "@/domain/dto/parse";
import { DTO_COOLDOWN_DAYS, DTO_JUSTIFICATION_REASON, dtoCooldown } from "@/domain/dto/suggestions";

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
export async function commitDtoImport(user: CurrentUser, rows: DtoImportRow[]): Promise<{ created: number; skipped: number }> {
  requirePermission(user, PERMISSIONS.DTO_MANAGE);
  const candidates = rows.filter((r) => r.action === "create" && r.collaboratorId);
  const valid = new Set(
    (await db.collaborator.findMany({ where: { id: { in: candidates.map((r) => r.collaboratorId!) } }, select: { id: true } })).map((c) => c.id),
  );
  const toCreate = candidates.filter((r) => valid.has(r.collaboratorId!));
  if (toCreate.length === 0) return { created: 0, skipped: rows.length };

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
  return { created: result.count, skipped: rows.length - result.count };
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
};

/** Sugestões de DTO: colaboradores ativos no SIGO, do mais tempo sem DTO pro menos. Quem nunca foi avaliado vem
 * primeiro. Quem teve um DTO (ou uma justificativa) há menos de 60 dias está em carência: não é sugerido ainda. */
export async function getDtoSuggestions(user: CurrentUser) {
  requireDtoView(user);
  const todayKey = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");

  const [collaborators, evaluations, justifications] = await Promise.all([
    db.collaborator.findMany({
      where: { active: true },
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
  ]);

  const lastDto = new Map<string, { date: Date; activity: string }>();
  for (const e of evaluations) if (!lastDto.has(e.collaboratorId)) lastDto.set(e.collaboratorId, { date: e.date, activity: e.activity });
  const lastJust = new Map<string, (typeof justifications)[number]>();
  for (const j of justifications) if (!lastJust.has(j.collaboratorId)) lastJust.set(j.collaboratorId, j);

  const items: DtoSuggestion[] = collaborators.map((c) => {
    const dto = lastDto.get(c.id) ?? null;
    const just = lastJust.get(c.id) ?? null;
    const lastEffectiveDate = [dto?.date, just?.date].filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    const cooldown = dtoCooldown(lastEffectiveDate, todayKey);
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
      eligible: cooldown.eligible,
      eligibleOn: cooldown.eligibleOn,
    };
  });

  // Nunca avaliados primeiro (os mais antigos na casa antes), depois quem está há mais tempo sem DTO.
  items.sort((a, b) => {
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
