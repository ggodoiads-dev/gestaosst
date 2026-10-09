import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission, hasPermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { normalizeText, parseDtoWorkbook, type DtoAnswer, type DtoRawRow } from "@/domain/dto/parse";

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
