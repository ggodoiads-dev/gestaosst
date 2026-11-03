import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { TERMINATION_FIELD_ALIASES, TERMINATION_IMPORT_FIELDS, type TerminationImportField, type TerminationImportMapping } from "@/domain/termination/import-fields";
import {
  classifyTermination,
  countsAsTurnover,
  effectiveKind,
  tenureBucket,
  tenureDays,
  terminationKey,
  turnoverRate,
  TENURE_BUCKET_LABEL,
  TERMINATION_KIND_LABEL,
  type TerminationKind,
} from "@/domain/termination/rules";
import { presenceAt } from "@/domain/termination/presence";
import { loadPresence } from "@/server/services/turnover-base";
import { parseSpreadsheet, suggestMapping as suggestMappingGeneric, getCell, normalize, parseDateCell } from "@/lib/spreadsheet-import";

export type { TerminationImportField, TerminationImportMapping };
export { parseSpreadsheet };

export function suggestMapping(headers: string[]): TerminationImportMapping {
  return suggestMappingGeneric(headers, TERMINATION_IMPORT_FIELDS.map((f) => f.key), TERMINATION_FIELD_ALIASES);
}

export type TerminationImportRow = {
  rowIndex: number;
  action: "create" | "skip" | "error";
  skipReason?: string;
  error?: string;
  name: string;
  matricula: string | null;
  cargo: string | null;
  areaName: string | null;
  turnoName: string | null;
  admissionDate: Date | null;
  terminationDate: Date | null;
  kind: TerminationKind;
  reason: string | null;
  notes: string | null;
  collaboratorId: string | null;
  dedupKey: string | null;
};

const RH = PERMISSIONS.HR_MANAGE;

/** Lê as linhas, casa cada uma com o cadastro (matrícula, depois nome inteiro) e marca as que já estão no SIGO ou repetidas no arquivo. Não grava nada. */
export async function buildTerminationImportPreview(user: CurrentUser, rows: string[][], mapping: TerminationImportMapping): Promise<TerminationImportRow[]> {
  requirePermission(user, RH);
  const collaborators = await db.collaborator.findMany({ select: { id: true, name: true, matricula: true } });
  const byMatricula = new Map(collaborators.filter((c) => c.matricula).map((c) => [normalize(c.matricula!), c.id]));
  const byName = new Map<string, string | null>();
  for (const c of collaborators) {
    const k = normalize(c.name);
    byName.set(k, byName.has(k) ? null : c.id); // nome repetido: não dá para ter certeza de quem é
  }
  const existing = new Set<string>();
  try {
    for (const t of await db.termination.findMany({ select: { dedupKey: true } })) existing.add(t.dedupKey);
  } catch (error) {
    console.error("[termination] tabela de desligamentos indisponível:", error);
  }

  const seen = new Set<string>();
  return rows.map((row, rowIndex) => {
    const name = getCell(row, mapping, "name");
    const terminationDate = parseDateCell(getCell(row, mapping, "terminationDate"));
    const matricula = getCell(row, mapping, "matricula");
    const base = {
      rowIndex,
      name: name ?? "",
      matricula,
      cargo: getCell(row, mapping, "cargo"),
      areaName: getCell(row, mapping, "area"),
      turnoName: getCell(row, mapping, "turno"),
      admissionDate: parseDateCell(getCell(row, mapping, "admissionDate")),
      terminationDate,
      kind: classifyTermination(getCell(row, mapping, "kind"), getCell(row, mapping, "reason")),
      reason: getCell(row, mapping, "reason") ?? getCell(row, mapping, "kind"),
      notes: getCell(row, mapping, "notes"),
      collaboratorId: (matricula ? byMatricula.get(normalize(matricula)) : undefined) ?? (name ? (byName.get(normalize(name)) ?? null) : null),
      dedupKey: null as string | null,
    };
    if (!name && !terminationDate && row.every((c) => !c || c.trim() === "")) return { ...base, action: "skip" as const, skipReason: "linha vazia" };
    if (!name) return { ...base, action: "error" as const, error: "Sem nome." };
    if (!terminationDate) return { ...base, action: "error" as const, error: "Data do desligamento ausente ou inválida." };
    const dedupKey = terminationKey(matricula, name, terminationDate);
    if (existing.has(dedupKey)) return { ...base, dedupKey, action: "skip" as const, skipReason: "já está no SIGO" };
    if (seen.has(dedupKey)) return { ...base, dedupKey, action: "skip" as const, skipReason: "repetida no arquivo" };
    seen.add(dedupKey);
    return { ...base, dedupKey, action: "create" as const };
  });
}

export async function commitTerminationImport(user: CurrentUser, rows: TerminationImportRow[]): Promise<{ created: number; skipped: number; errors: number }> {
  requirePermission(user, RH);
  const toCreate = rows.filter((r) => r.action === "create" && r.dedupKey && r.terminationDate);
  const result = await db.termination.createMany({
    skipDuplicates: true,
    data: toCreate.map((r) => ({
      dedupKey: r.dedupKey!,
      collaboratorId: r.collaboratorId,
      name: r.name,
      matricula: r.matricula,
      cargo: r.cargo,
      areaName: r.areaName,
      turnoName: r.turnoName,
      admissionDate: r.admissionDate,
      terminationDate: r.terminationDate!,
      kind: r.kind,
      reason: r.reason,
      notes: r.notes,
      importedById: user.id,
    })),
  });
  await recordAudit({ userId: user.id, action: "CREATE", entityType: "Termination", entityId: "import", newValue: { created: result.count, rows: rows.length } });
  return { created: result.count, skipped: rows.filter((r) => r.action === "skip").length + (toCreate.length - result.count), errors: rows.filter((r) => r.action === "error").length };
}

export async function deleteTermination(user: CurrentUser, id: string) {
  requirePermission(user, RH);
  const row = await db.termination.findUnique({ where: { id } });
  if (!row) return;
  await db.termination.delete({ where: { id } });
  await recordAudit({ userId: user.id, action: "DELETE", entityType: "Termination", entityId: id, previousValue: { name: row.name, terminationDate: row.terminationDate.toISOString().slice(0, 10), kind: row.kind } });
}

export type TurnoverMonth = { month: string; exits: number; headcountStart: number; headcountEnd: number; rate: number | null };

export type TurnoverView = {
  ready: boolean;
  year: number;
  years: number[];
  totals: { exits: number; outside: number; voluntary: number; company: number; agreement: number; other: number; unclassified: number; early90: number; withTenure: number; yearRate: number | null; avgTenureDays: number | null };
  months: TurnoverMonth[];
  byKind: { label: string; count: number }[];
  byTenure: { label: string; count: number }[];
  byArea: { label: string; count: number }[];
  byTurno: { label: string; count: number }[];
  byCargo: { label: string; count: number }[];
  byReason: { label: string; count: number }[];
  list: { id: string; name: string; cargo: string | null; areaName: string | null; turnoName: string | null; admissionDate: Date | null; terminationDate: Date; kind: TerminationKind; reason: string | null; tenureDays: number | null; linked: boolean }[];
};

const countBy = <T,>(list: T[], key: (t: T) => string | null, empty = "Não informado") => {
  const m = new Map<string, number>();
  for (const i of list) {
    const k = key(i) ?? empty;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
};

/** Visão do ano: turnover mês a mês (desligamentos ÷ média do efetivo, que vem do cadastro: admissão e inativação), tipos, tempo de casa e onde se concentram. */
export async function getTurnoverView(user: CurrentUser, year: number): Promise<TurnoverView> {
  requirePermission(user, RH);
  const empty: TurnoverView = {
    ready: false,
    year,
    years: [year],
    totals: { exits: 0, outside: 0, voluntary: 0, company: 0, agreement: 0, other: 0, unclassified: 0, early90: 0, withTenure: 0, yearRate: null, avgTenureDays: null },
    months: [],
    byKind: [],
    byTenure: [],
    byArea: [],
    byTurno: [],
    byCargo: [],
    byReason: [],
    list: [],
  };
  let all: Awaited<ReturnType<typeof db.termination.findMany>>;
  try {
    all = await db.termination.findMany({ orderBy: { terminationDate: "desc" } });
  } catch (error) {
    console.error("[termination] tabela de desligamentos indisponível:", error);
    return empty;
  }
  const years = [...new Set([year, ...all.map((t) => t.terminationDate.getFullYear())])].sort((a, b) => b - a);
  const kindOfRow = (t: (typeof all)[number]): TerminationKind => effectiveKind(t.kind, t.reason);
  const ofYear = all.filter((t) => t.terminationDate.getFullYear() === year);
  const rows = ofYear.filter((t) => countsAsTurnover(kindOfRow(t)));
  const { people } = await loadPresence();

  const now = new Date();
  const months: TurnoverMonth[] = [];
  for (let m = 0; m < 12; m++) {
    const start = new Date(year, m, 1);
    if (start > now) break;
    const end = new Date(year, m + 1, 1);
    const hs = presenceAt(people, start);
    const he = presenceAt(people, end > now ? now : end);
    const exits = rows.filter((t) => t.terminationDate.getMonth() === m).length;
    months.push({ month: `${year}-${String(m + 1).padStart(2, "0")}`, exits, headcountStart: hs, headcountEnd: he, rate: turnoverRate(exits, hs, he) });
  }
  const avgHeadcount = months.length ? months.reduce((s, x) => s + (x.headcountStart + x.headcountEnd) / 2, 0) / months.length : 0;
  const withDays = rows.map((t) => tenureDays(t.admissionDate, t.terminationDate));
  const known = withDays.filter((d): d is number => d !== null);
  const kindOf = kindOfRow;
  const listDays = ofYear.map((t) => tenureDays(t.admissionDate, t.terminationDate));
  const list = ofYear.map((t, i) => ({
    id: t.id,
    name: t.name,
    cargo: t.cargo,
    areaName: t.areaName,
    turnoName: t.turnoName,
    admissionDate: t.admissionDate,
    terminationDate: t.terminationDate,
    kind: kindOf(t),
    reason: t.reason,
    tenureDays: listDays[i],
    linked: !!t.collaboratorId,
  }));

  return {
    ready: true,
    year,
    years,
    totals: {
      exits: rows.length,
      outside: ofYear.length - rows.length,
      voluntary: rows.filter((t) => kindOfRow(t) === "VOLUNTARIO").length,
      company: rows.filter((t) => kindOfRow(t) === "INVOLUNTARIO").length,
      agreement: rows.filter((t) => kindOfRow(t) === "ACORDO").length,
      other: rows.filter((t) => kindOfRow(t) === "OUTRO").length,
      unclassified: rows.filter((t) => kindOfRow(t) === "NAO_CLASSIFICADO").length,
      early90: known.filter((d) => d <= 90).length,
      withTenure: known.length,
      // Taxa do ano = desligamentos acumulados ÷ efetivo médio dos meses já corridos (não é a soma das taxas mensais).
      yearRate: avgHeadcount > 0 ? Math.round((rows.length / avgHeadcount) * 1000) / 10 : null,
      avgTenureDays: known.length ? Math.round(known.reduce((s, d) => s + d, 0) / known.length) : null,
    },
    months,
    byKind: countBy(rows, (t) => TERMINATION_KIND_LABEL[kindOf(t)]),
    byTenure: Object.entries(TENURE_BUCKET_LABEL).map(([k, label]) => ({ label, count: withDays.filter((d) => tenureBucket(d) === k).length })).filter((x) => x.count > 0),
    byArea: countBy(rows, (t) => t.areaName),
    byTurno: countBy(rows, (t) => t.turnoName),
    byCargo: countBy(rows, (t) => t.cargo),
    byReason: countBy(rows, (t) => t.reason, "Sem motivo informado").slice(0, 10),
    list,
  };
}
