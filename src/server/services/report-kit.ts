import type { CurrentUser } from "@/server/auth/current-user";
import type { Finding, MonthlyReport, ReportSection, ReportTable } from "@/domain/reports/types";

/** Peças comuns dos relatórios específicos (cada módulo monta seções com elas). */
export type DetailCtx = { user: CurrentUser; month: string; prev: string; internal: boolean; nowKey: string };
export type Out = { title: string; executive: MonthlyReport["executive"]; findings: Finding[]; sections: ReportSection[] };

export const keyOfDate = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
export const avgOf = (v: number[]) => (v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null);

export function countBy<T>(list: T[], key: (t: T) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const i of list) m.set(key(i), (m.get(key(i)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export const sec = (key: string, title: string, scope: string, p: Partial<ReportSection> = {}): ReportSection => ({ key, title, scope, kpis: [], series: [], tables: [], notes: [], ...p });
export const tbl = (title: string, columns: string[], rows: (string | number)[][], extra: Partial<ReportTable> = {}): ReportTable => ({ title, columns, rows, ...extra });
