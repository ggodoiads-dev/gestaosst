import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { hasPermission, requirePermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import type { TmaRowInput } from "@/domain/tma/parse";
import { computeTmaStats, parseTmaKey, tmaMetricValue, type TmaStats, type TmaStatsRow } from "@/domain/tma/stats";

/**
 * TMA de caminhões, importado da planilha de controle de atendimento (a mesma da Ambev). Ver exige indicadores consolidados (ou a
 * produtividade); importar exige gerenciar produtividade — os perfis Gestor e Administrador.
 */

export function canViewTma(user: CurrentUser): boolean {
  return hasPermission(user, PERMISSIONS.INDICATORS_VIEW_CONSOLIDATED) || hasPermission(user, PERMISSIONS.PRODUCTIVITY_VIEW) || hasPermission(user, PERMISSIONS.PRODUCTIVITY_MANAGE);
}
export function canImportTma(user: CurrentUser): boolean {
  return hasPermission(user, PERMISSIONS.PRODUCTIVITY_MANAGE);
}

const MAX_ROWS = 4000;
const asDate = (iso: string | null): Date | null => {
  if (!iso) return null;
  const d = new Date(`${iso.length === 10 ? `${iso}T12:00` : iso}:00Z`.replace("::", ":"));
  return Number.isNaN(d.getTime()) ? null : d;
};
const clampText = (v: string | null) => (v === null ? null : String(v).slice(0, 120));
const num = (v: number | null) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Grava o mês: as linhas que já existiam dele são substituídas (reimportar a aba fechada atualiza, não duplica). */
export async function importTmaMonth(user: CurrentUser, input: { periodKey: string; fileName: string; rows: TmaRowInput[] }) {
  if (!canImportTma(user)) throw new ForbiddenError();
  if (!/^\d{4}-\d{2}$/.test(input.periodKey)) throw new Error("Mês inválido.");
  if (input.rows.length === 0) throw new Error("A aba não tem caminhões.");
  if (input.rows.length > MAX_ROWS) throw new Error("A aba tem linhas demais.");

  const data = input.rows.flatMap((r) => {
    const grade = asDate(r.gradeDate);
    if (!grade || !r.status) return [];
    return [
      {
        periodKey: input.periodKey,
        gradeDate: grade,
        status: String(r.status).slice(0, 40),
        presentation: clampText(r.presentation),
        destino: clampText(r.destino),
        tipoCarro: clampText(r.tipoCarro),
        pedido: clampText(r.pedido),
        placas: clampText(r.placas),
        motorista: clampText(r.motorista),
        transportadora: clampText(r.transportadora),
        conferente: clampText(r.conferente),
        turno: clampText(r.turno),
        checklist: clampText(r.checklist),
        agendamento: asDate(r.agendamento),
        apresentacao: asDate(r.apresentacao),
        entradaAtendimento: asDate(r.entradaAtendimento),
        entradaBaia: asDate(r.entradaBaia),
        inicioCarregamento: asDate(r.inicioCarregamento),
        fimCarregamento: asDate(r.fimCarregamento),
        fimAmarracao: asDate(r.fimAmarracao),
        liberacao: asDate(r.liberacao),
        tmaMin: num(r.tmaMin),
        atendimentoMin: num(r.atendimentoMin),
        patioMin: num(r.patioMin),
        esperaMin: num(r.esperaMin),
        tmcMin: num(r.tmcMin),
        amarracaoMin: num(r.amarracaoMin),
        liberacaoMin: num(r.liberacaoMin),
      },
    ];
  });
  if (data.length === 0) throw new Error("Nenhuma linha válida nesta aba.");

  const imported = await db.$transaction(
    async (tx) => {
      const created = await tx.tmaImport.create({ data: { periodKey: input.periodKey, fileName: input.fileName.slice(0, 200), rows: data.length, importedById: user.id } });
      await tx.tmaTruck.deleteMany({ where: { periodKey: input.periodKey } });
      await tx.tmaTruck.createMany({ data: data.map((d) => ({ ...d, importId: created.id })) });
      return created;
    },
    { timeout: 60000, maxWait: 20000 },
  );
  await recordAudit({ userId: user.id, action: "CREATE", entityType: "TmaImport", entityId: imported.id, newValue: { periodKey: input.periodKey, rows: data.length, fileName: input.fileName } });
  return { rows: data.length };
}

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 16) : null);

async function loadRows(periodKeys: string[]): Promise<TmaStatsRow[]> {
  const rows = await db.tmaTruck.findMany({
    where: { periodKey: { in: periodKeys } },
    select: {
      status: true,
      agendamento: true,
      apresentacao: true,
      liberacao: true,
      tmaMin: true,
      atendimentoMin: true,
      patioMin: true,
      esperaMin: true,
      tmcMin: true,
      amarracaoMin: true,
      liberacaoMin: true,
      transportadora: true,
      destino: true,
      conferente: true,
      turno: true,
    },
  });
  return rows.map((r) => ({ ...r, agendamento: iso(r.agendamento), apresentacao: iso(r.apresentacao), liberacao: iso(r.liberacao) }));
}

export type TmaView = {
  ready: boolean;
  months: string[];
  selected: string | null;
  year: number | null;
  month: TmaStats | null;
  ytd: TmaStats | null;
  importedAt: Date | null;
};

export async function getTmaView(user: CurrentUser, periodParam?: string): Promise<TmaView> {
  if (!canViewTma(user)) throw new ForbiddenError();
  let months: string[] = [];
  let lastImport: Date | null = null;
  try {
    const groups = await db.tmaTruck.groupBy({ by: ["periodKey"], _count: { _all: true } });
    months = groups.map((g) => g.periodKey).sort();
    lastImport = (await db.tmaImport.findFirst({ orderBy: { importedAt: "desc" }, select: { importedAt: true } }))?.importedAt ?? null;
  } catch (error) {
    console.error("[tma] tabelas indisponíveis:", error);
    return { ready: false, months: [], selected: null, year: null, month: null, ytd: null, importedAt: null };
  }
  if (months.length === 0) return { ready: true, months: [], selected: null, year: null, month: null, ytd: null, importedAt: null };

  const selected = periodParam && months.includes(periodParam) ? periodParam : months[months.length - 1];
  const year = selected.slice(0, 4);
  const ytdMonths = months.filter((m) => m.startsWith(year) && m <= selected);
  const [monthRows, ytdRows] = await Promise.all([loadRows([selected]), loadRows(ytdMonths)]);
  return { ready: true, months, selected, year: Number(year), month: computeTmaStats(monthRows), ytd: computeTmaStats(ytdRows), importedAt: lastImport };
}

/** Valor de um indicador do cascateamento ligado ao TMA (`tma.avg`, `tma.within3h.ytd`, `tma.stage:patio`...) no mês AAAA-MM; `null` se o mês não foi importado. */
export async function resolveTmaMetric(key: string, periodKey: string): Promise<number | null> {
  const parsed = parseTmaKey(key);
  if (!parsed) return null;
  const year = periodKey.slice(0, 4);
  const periods = parsed.ytd ? Array.from({ length: Number(periodKey.slice(5, 7)) }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`) : [periodKey];
  const rows = await loadRows(periods);
  if (rows.length === 0) return null;
  return tmaMetricValue(computeTmaStats(rows), parsed);
}
