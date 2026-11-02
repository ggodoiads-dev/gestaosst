/**
 * Relatório mensal do SIGO. Tudo que aparece nele é calculado de dados do sistema; os "pontos críticos" vêm de regras fixas (analysis.ts) e a análise
 * em texto (IA) só comenta os números que estão aqui.
 */

export type ReportVersion = "interno" | "cliente";

export type Tone = "good" | "bad" | "warn" | "neutral";

export type Kpi = {
  key: string;
  label: string;
  /** Valor já formatado ("96%", "4:07", "12"). */
  value: string;
  /** Comparação com o mês anterior, já escrita ("+3 pts", "−12%"), e se isso é bom ou ruim. */
  delta?: string;
  tone: Tone;
  note?: string;
};

export type FindingSeverity = "CRITICO" | "ALTO" | "ATENCAO" | "INFO";

export type Finding = {
  severity: FindingSeverity;
  module: string;
  title: string;
  detail: string;
  recommendation?: string;
  /** Só aparece na versão interna (tem dado de pessoa ou de gestão). */
  internalOnly?: boolean;
};

export type ReportTable = {
  title: string;
  columns: string[];
  rows: (string | number)[][];
  /** Índices das colunas alinhadas à direita (números). */
  rightAlign?: number[];
  internalOnly?: boolean;
  note?: string;
};

export type ReportSeries = { title: string; unit?: string; points: { label: string; value: number }[]; highlightLast?: boolean };

export type ReportSection = {
  key: string;
  title: string;
  /** O que esta seção mede e de onde vêm os números (uma linha). */
  scope: string;
  kpis: Kpi[];
  series: ReportSeries[];
  tables: ReportTable[];
  notes: string[];
};

export type MonthlyReport = {
  month: string;
  monthLabel: string;
  version: ReportVersion;
  generatedAt: string;
  generatedBy: string;
  executive: Kpi[];
  findings: Finding[];
  sections: ReportSection[];
  /** Módulos que não puderam ser lidos (sem permissão ou sem dado). */
  unavailable: string[];
};
