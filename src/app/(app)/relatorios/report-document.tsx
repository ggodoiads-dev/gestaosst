import { cn } from "@/lib/utils";
import type { Finding, FindingSeverity, Kpi, MonthlyReport, ReportTable, Tone } from "@/domain/reports/types";
import { SeriesBars } from "./report-charts";

const TONE_TEXT: Record<Tone, string> = { good: "text-success", bad: "text-danger", warn: "text-warning", neutral: "text-foreground-subtle" };
const TONE_BAR: Record<Tone, string> = { good: "bg-success", bad: "bg-danger", warn: "bg-warning", neutral: "bg-border-strong" };

const SEVERITY: Record<FindingSeverity, { label: string; chip: string; rail: string }> = {
  CRITICO: { label: "Crítico", chip: "bg-danger text-white", rail: "border-l-danger" },
  ALTO: { label: "Alto", chip: "bg-danger-soft text-danger", rail: "border-l-danger" },
  ATENCAO: { label: "Atenção", chip: "bg-warning-soft text-warning", rail: "border-l-warning" },
  INFO: { label: "Informativo", chip: "bg-info-soft text-info", rail: "border-l-info" },
};

function KpiTile({ k, big }: { k: Kpi; big?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-md border border-border bg-surface px-3 py-2.5 break-inside-avoid">
      <span className={cn("absolute inset-y-0 left-0 w-1", TONE_BAR[k.tone])} aria-hidden />
      <p className="pl-1 text-[11px] uppercase tracking-wide text-foreground-subtle">{k.label}</p>
      <p className={cn("pl-1 font-semibold tabular-nums text-foreground", big ? "text-2xl" : "text-xl")}>{k.value}</p>
      {k.delta && <p className={cn("pl-1 text-[11px] font-medium", TONE_TEXT[k.tone])}>{k.delta}</p>}
      {k.note && <p className="pl-1 text-[11px] text-foreground-subtle">{k.note}</p>}
    </div>
  );
}

function FindingRow({ f }: { f: Finding }) {
  const s = SEVERITY[f.severity];
  return (
    <li className={cn("break-inside-avoid rounded-md border border-border border-l-4 bg-surface px-3 py-2", s.rail)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", s.chip)}>{s.label}</span>
        <span className="text-[11px] font-medium uppercase tracking-wide text-foreground-subtle">{f.module}</span>
      </div>
      <p className="mt-1 text-sm font-semibold text-foreground">{f.title}</p>
      <p className="text-sm text-foreground-muted">{f.detail}</p>
      {f.recommendation && (
        <p className="mt-1 text-sm text-foreground">
          <span className="font-semibold">Ação sugerida: </span>
          {f.recommendation}
        </p>
      )}
    </li>
  );
}

function Table({ t }: { t: ReportTable }) {
  const right = new Set(t.rightAlign ?? []);
  return (
    <div className={cn("break-inside-avoid overflow-hidden rounded-md border border-border bg-surface", t.columns.length >= 4 && "lg:col-span-2")}>
      <p className="border-b border-border bg-surface-muted px-3 py-1.5 text-xs font-semibold text-foreground">{t.title}</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] uppercase tracking-wide text-foreground-subtle">
            {t.columns.map((c, i) => (
              <th key={c} className={cn("px-3 py-1 font-semibold", right.has(i) ? "text-right" : "text-left")}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.rows.map((row, ri) => (
            <tr key={ri} className="border-b border-border last:border-b-0">
              {row.map((cell, ci) => (
                <td key={ci} className={cn("px-3 py-1", right.has(ci) ? "text-right tabular-nums text-foreground" : "text-foreground")}>{cell}</td>
              ))}
            </tr>
          ))}
          {t.rows.length === 0 && (
            <tr>
              <td colSpan={t.columns.length} className="px-3 py-3 text-center text-foreground-subtle">Sem registros no período.</td>
            </tr>
          )}
        </tbody>
      </table>
      {t.note && <p className="border-t border-border px-3 py-1 text-[11px] text-foreground-subtle">{t.note}</p>}
    </div>
  );
}

export function ReportDocument({ report }: { report: MonthlyReport }) {
  const generated = new Date(report.generatedAt);
  const generatedLabel = generated.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  const counts = (["CRITICO", "ALTO", "ATENCAO"] as FindingSeverity[]).map((s) => ({ s, n: report.findings.filter((f) => f.severity === s).length }));

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-border bg-background p-5 print:border-0 print:p-0 sm:p-8">
      <header className="break-inside-avoid border-b-2 border-foreground pb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-subtle">SIGO · Sistema Interno de Gestão Organizacional</p>
        <h1 className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">Relatório mensal de segurança e operação</h1>
        <p className="text-lg font-medium text-foreground-muted">{report.monthLabel}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground-subtle">
          <span className="rounded bg-foreground px-2 py-0.5 font-semibold uppercase tracking-wide text-background">{report.version === "cliente" ? "Versão cliente" : "Versão interna — gestão"}</span>
          <span>Emitido em {generatedLabel}</span>
          <span>Por {report.generatedBy}</span>
        </div>
      </header>

      {report.executive.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">Resumo executivo</h2>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {report.executive.map((k) => (
              <KpiTile key={k.key} k={k} big />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">Pontos críticos</h2>
          <p className="text-xs text-foreground-subtle">
            {counts.map((c) => `${c.n} ${SEVERITY[c.s].label.toLowerCase()}${c.n === 1 ? "" : "s"}`).join(" · ")}
          </p>
        </div>
        {report.findings.length === 0 ? (
          <p className="rounded-md border border-border bg-surface px-3 py-3 text-sm text-foreground-muted">Nenhum ponto crítico detectado pelas regras do relatório neste mês.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {report.findings.map((f, i) => (
              <FindingRow key={i} f={f} />
            ))}
          </ul>
        )}
      </section>

      {report.sections.map((s, i) => (
        <section key={s.key} className="flex flex-col gap-3 print:break-before-auto">
          <div className="break-after-avoid border-b border-border pb-1">
            <h2 className="text-base font-bold text-foreground">
              <span className="mr-2 text-foreground-subtle">{String(i + 1).padStart(2, "0")}</span>
              {s.title}
            </h2>
            <p className="text-xs text-foreground-subtle">{s.scope}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {s.kpis.map((k) => (
              <KpiTile key={k.key} k={k} />
            ))}
          </div>
          {s.series.map((x) => (
            <SeriesBars key={x.title} series={x} />
          ))}
          {s.tables.length > 0 && (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {s.tables.map((t) => (
                <Table key={t.title} t={t} />
              ))}
            </div>
          )}
          {s.notes.map((n) => (
            <p key={n} className="text-xs text-foreground-subtle">{n}</p>
          ))}
        </section>
      ))}

      <footer className="break-inside-avoid border-t border-border pt-3 text-[11px] leading-relaxed text-foreground-subtle">
        <p>
          Números calculados pelo SIGO a partir dos dados lançados e importados até a emissão. Pontos críticos vêm de regras fixas; a análise em texto, quando
          presente, foi escrita por IA apenas sobre os números deste relatório e deve ser revisada antes de ser enviada.
        </p>
        {report.unavailable.length > 0 && <p className="mt-1">Módulos não incluídos (sem acesso ou sem dados no período): {report.unavailable.join(", ")}.</p>}
      </footer>
    </article>
  );
}
