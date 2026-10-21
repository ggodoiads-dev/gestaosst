import "server-only";
import * as XLSX from "xlsx";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { parseDreGrid, type ParsedDre } from "@/domain/dre/parse";
import { avrPercent, parseDreKey, ratioPercent, sumAmounts } from "@/domain/dre/metrics";

/** DRE importado do export da plataforma financeira. Ver e importar exige acesso a dados de RH/financeiro. */

function requireDre(user: CurrentUser) {
  requirePermission(user, PERMISSIONS.HR_MANAGE);
}

export function parseDreBuffer(buffer: Buffer): ParsedDre {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null });
  return parseDreGrid(grid);
}

export type DrePreview = {
  unit: string | null;
  officialAt: string | null;
  warnings: string[];
  months: { periodKey: string; label: string; lines: number; revenue: number; ebitda: number; ebitdaAvr: number; replaces: boolean }[];
};

const line = (month: ParsedDre["months"][number], code: string) => month.lines.find((l) => l.code === code);

/** O que o arquivo traz e o que ele vai substituir — nada é gravado aqui. */
export async function previewDre(user: CurrentUser, buffer: Buffer): Promise<DrePreview> {
  requireDre(user);
  const parsed = parseDreBuffer(buffer);
  let existing = new Set<string>();
  try {
    const rows = await db.dreLine.findMany({ select: { periodKey: true }, distinct: ["periodKey"] });
    existing = new Set(rows.map((r) => r.periodKey));
  } catch (error) {
    console.error("[dre] tabela indisponível:", error);
  }
  return {
    unit: parsed.unit,
    officialAt: parsed.officialAt,
    warnings: parsed.warnings,
    months: parsed.months.map((m) => ({
      periodKey: m.periodKey,
      label: m.label.replace(/\s*\(.*\)\s*$/, ""),
      lines: m.lines.length,
      revenue: line(m, "001")?.realizado ?? 0,
      ebitda: line(m, "233")?.realizado ?? 0,
      ebitdaAvr: line(m, "233")?.avr ?? 0,
      replaces: existing.has(m.periodKey),
    })),
  };
}

/** Grava os meses do arquivo; mês que já existia é substituído (reimportar o DRE fechado atualiza, não duplica). */
export async function commitDre(user: CurrentUser, buffer: Buffer, fileName: string) {
  requireDre(user);
  const parsed = parseDreBuffer(buffer);
  if (parsed.months.length === 0 || parsed.months.every((m) => m.lines.length === 0)) throw new Error("Arquivo sem contas do DRE.");

  const imported = await db.$transaction(
    async (tx) => {
      const created = await tx.dreImport.create({
        data: { fileName, unit: parsed.unit, officialAt: parsed.officialAt, months: parsed.months.map((m) => m.periodKey), importedById: user.id },
      });
      for (const month of parsed.months) {
        await tx.dreLine.deleteMany({ where: { periodKey: month.periodKey } });
        await tx.dreLine.createMany({
          data: month.lines.map((l) => ({
            importId: created.id,
            periodKey: month.periodKey,
            code: l.code,
            name: l.name,
            level: l.level,
            position: l.position,
            remunerado: l.remunerado,
            realizado: l.realizado,
            diferenca: l.diferenca,
            avr: l.avr,
          })),
        });
      }
      return created;
    },
    { timeout: 60000, maxWait: 20000 },
  );
  await recordAudit({
    userId: user.id,
    action: "CREATE",
    entityType: "DreImport",
    entityId: imported.id,
    newValue: { fileName, unit: parsed.unit, officialAt: parsed.officialAt, months: parsed.months.map((m) => m.periodKey) },
  });
  return { months: parsed.months.length };
}

// ---------------------------------------------------------------------------------------------------------------------
// Leitura (tela do DRE)
// ---------------------------------------------------------------------------------------------------------------------

/** [remunerado, realizado, diferença, AVR %] */
export type DreCell = [number, number, number, number];
export type DreViewLine = { code: string; name: string; level: number; byMonth: Record<string, DreCell>; ytd: DreCell };

export type DreView = {
  ready: boolean;
  months: string[];
  year: number | null;
  meta: { unit: string | null; officialAt: string | null; importedAt: Date | null; fileName: string | null } | null;
  lines: DreViewLine[];
};

export async function getDreView(user: CurrentUser): Promise<DreView> {
  requireDre(user);
  let rows: Awaited<ReturnType<typeof db.dreLine.findMany>> = [];
  let lastImport: Awaited<ReturnType<typeof db.dreImport.findFirst>> = null;
  try {
    [rows, lastImport] = await Promise.all([
      db.dreLine.findMany({ orderBy: [{ position: "asc" }, { periodKey: "asc" }] }),
      db.dreImport.findFirst({ orderBy: { importedAt: "desc" } }),
    ]);
  } catch (error) {
    console.error("[dre] tabelas indisponíveis:", error);
    return { ready: false, months: [], year: null, meta: null, lines: [] };
  }
  if (rows.length === 0) return { ready: true, months: [], year: null, meta: null, lines: [] };

  const months = [...new Set(rows.map((r) => r.periodKey))].sort();
  const year = Number(months[months.length - 1].slice(0, 4));
  const ytdMonths = new Set(months.filter((m) => m.startsWith(String(year))));
  const revenueYtd = sumAmounts(rows.filter((r) => r.code === "001" && ytdMonths.has(r.periodKey)));

  const byCode = new Map<string, DreViewLine>();
  for (const r of rows) {
    let l = byCode.get(r.code);
    if (!l) {
      l = { code: r.code, name: r.name, level: r.level, byMonth: {}, ytd: [0, 0, 0, 0] };
      byCode.set(r.code, l);
    }
    l.byMonth[r.periodKey] = [r.remunerado, r.realizado, r.diferenca, r.avr];
  }
  for (const l of byCode.values()) {
    const list = [...ytdMonths].map((m) => l.byMonth[m]).filter(Boolean);
    const amounts = sumAmounts(list.map((c) => ({ remunerado: c[0], realizado: c[1] })));
    l.ytd = [amounts.remunerado, amounts.realizado, amounts.realizado - amounts.remunerado, avrPercent(amounts, revenueYtd) ?? 0];
  }

  return {
    ready: true,
    months,
    year,
    meta: { unit: lastImport?.unit ?? null, officialAt: lastImport?.officialAt ?? null, importedAt: lastImport?.importedAt ?? null, fileName: lastImport?.fileName ?? null },
    lines: [...byCode.values()],
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Alimenta o cascateamento (sem checagem de usuário: quem chama já passou pela permissão do cascateamento)
// ---------------------------------------------------------------------------------------------------------------------

/** Valor de um indicador ligado ao DRE (`dre.avr:233`, `dre.avr:-021`, `dre.ratio:033`, e as versões `.ytd`) no período AAAA-MM.
 * `null` quando o mês ainda não foi importado. */
export async function resolveDreMetric(key: string, periodKey: string): Promise<number | null> {
  const parsed = parseDreKey(key);
  if (!parsed) return null;
  const year = periodKey.slice(0, 4);
  const periods = parsed.ytd
    ? Array.from({ length: Number(periodKey.slice(5, 7)) }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`)
    : [periodKey];
  const rows = await db.dreLine.findMany({
    where: { periodKey: { in: periods }, code: { in: [parsed.code, "001"] } },
    select: { periodKey: true, code: true, remunerado: true, realizado: true },
  });
  const target = rows.filter((r) => r.code === parsed.code);
  const revenue = rows.filter((r) => r.code === "001");
  if (target.length === 0) return null;
  const amounts = sumAmounts(target);
  const value = parsed.metric === "avr" ? avrPercent(amounts, sumAmounts(revenue)) : ratioPercent(amounts);
  if (value === null) return null;
  return parsed.negate ? -value : value;
}
