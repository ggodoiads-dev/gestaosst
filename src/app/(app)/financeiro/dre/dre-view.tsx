"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DreCell, DreView, DreViewLine } from "@/server/services/dre.service";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const money = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moneyShort = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil` : money(v));
const percent = (v: number | null) => (v === null || !Number.isFinite(v) ? "—" : `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`);
const monthName = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]}/${key.slice(0, 4)}`;
const shortName = (key: string) => MONTHS_SHORT[Number(key.slice(5, 7)) - 1];

/** Conta "usada": teve algum valor (mais de R$ 1) em qualquer mês. Contas sempre zeradas ficam fora da tela. */
function isUsed(line: DreViewLine) {
  return Object.values(line.byMonth).some((c) => Math.abs(c[0]) >= 1 || Math.abs(c[1]) >= 1);
}

export function DreViewClient({ view }: { view: DreView }) {
  const [selected, setSelected] = useState<string>("ytd");
  const lines = useMemo(() => view.lines.filter(isUsed), [view.lines]);
  const byCode = useMemo(() => new Map(lines.map((l) => [l.code, l])), [lines]);
  const cellOf = (l: DreViewLine | undefined, key: string): DreCell | null => (!l ? null : key === "ytd" ? l.ytd : (l.byMonth[key] ?? null));

  // Hierarquia pelo recuo: cada conta sabe se tem filhas e quem é o pai.
  const tree = useMemo(() => {
    const nodes = lines.map((l, i) => ({ line: l, index: i, parent: -1, hasChildren: false }));
    const stack: number[] = [];
    nodes.forEach((n, i) => {
      while (stack.length && nodes[stack[stack.length - 1]].line.level >= n.line.level) stack.pop();
      n.parent = stack.length ? stack[stack.length - 1] : -1;
      if (n.parent >= 0) nodes[n.parent].hasChildren = true;
      stack.push(i);
    });
    return nodes;
  }, [lines]);

  // Abre só os totalizadores: o resto o gerente abre clicando.
  const [open, setOpen] = useState<Set<string>>(() => new Set(lines.filter((l) => l.level === 0).map((l) => l.code)));
  const toggle = (code: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  const visible = tree.filter((n) => {
    let p = n.parent;
    while (p >= 0) {
      if (!open.has(tree[p].line.code)) return false;
      p = tree[p].parent;
    }
    return true;
  });

  const summaryLines = lines.filter((l) => l.level === 0);
  const selectedLabel = selected === "ytd" ? `Acumulado de janeiro a ${MONTHS[Number(view.months[view.months.length - 1].slice(5, 7)) - 1]}/${view.year}` : monthName(selected);

  const kpis = useMemo(() => {
    const revenue = cellOf(byCode.get("001"), selected);
    const avr = (code: string, negate = false) => {
      const c = cellOf(byCode.get(code), selected);
      return c ? (negate ? -c[3] : c[3]) : null;
    };
    const ebitda = cellOf(byCode.get("233"), selected);
    const personnel = cellOf(byCode.get("033"), selected);
    return [
      { label: "Receita líquida", value: revenue ? `R$ ${money(revenue[1])}` : "—", sub: revenue ? `remunerado R$ ${money(revenue[0])}` : "" },
      { label: "EBITDA", value: percent(avr("233")), sub: ebitda ? `R$ ${money(ebitda[1])}` : "" },
      { label: "Gastos totais", value: percent(avr("021", true)), sub: "custos operacionais ÷ receita" },
      { label: "Despesas administrativas", value: percent(avr("158", true)), sub: "÷ receita líquida" },
      { label: "Pacote de manutenção", value: percent(avr("114")), sub: "custos gerais com frota ÷ receita" },
      { label: "Pacote de gente", value: personnel && personnel[0] !== 0 ? percent((personnel[1] / personnel[0]) * 100) : "—", sub: "custo com pessoal: realizado ÷ remunerado" },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byCode, selected]);

  const evolution = [
    { label: "Receita líquida", code: "001", kind: "real" as const },
    { label: "Custos operacionais", code: "021", kind: "avr" as const, negate: true },
    { label: "Lucro operacional", code: "157", kind: "real" as const },
    { label: "Despesas administrativas", code: "158", kind: "avr" as const, negate: true },
    { label: "EBITDA", code: "233", kind: "real" as const },
    { label: "EBITDA", code: "233", kind: "avr" as const },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <label className="flex flex-col gap-1 text-xs text-foreground-subtle">
          Período
          <select value={selected} onChange={(e) => setSelected(e.target.value)} className="h-9 min-w-56 rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground">
            <option value="ytd">Acumulado do ano (YTD)</option>
            {[...view.months].reverse().map((m) => (
              <option key={m} value={m}>{monthName(m)}</option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-foreground-subtle">
          {view.meta?.unit && <span>Unidade: <strong className="text-foreground-muted">{view.meta.unit}</strong></span>}
          {view.meta?.officialAt && <span>Oficial em: <strong className="text-foreground-muted">{view.meta.officialAt}</strong></span>}
          <span>Meses: <strong className="text-foreground-muted">{shortName(view.months[0])} a {shortName(view.months[view.months.length - 1])}/{view.year}</strong></span>
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Indicadores — {selectedLabel}</h2>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-6">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-md border border-border bg-surface px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide text-foreground-subtle">{k.label}</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{k.value}</p>
              {k.sub && <p className="text-[11px] text-foreground-subtle">{k.sub}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Receita líquida por mês" legend={[{ label: "Remunerado", color: "var(--border-strong)" }, { label: "Realizado", color: "var(--accent)" }]}>
          <BarChart
            labels={view.months.map(shortName)}
            series={[
              { color: "var(--border-strong)", values: view.months.map((m) => byCode.get("001")?.byMonth[m]?.[0] ?? 0) },
              { color: "var(--accent)", values: view.months.map((m) => byCode.get("001")?.byMonth[m]?.[1] ?? 0) },
            ]}
            format={moneyShort}
          />
        </ChartCard>
        <ChartCard title="EBITDA — % da receita" legend={[{ label: "Positivo", color: "var(--success)" }, { label: "Negativo", color: "var(--danger)" }]}>
          <BarChart
            labels={view.months.map(shortName)}
            series={[{ color: "var(--success)", negativeColor: "var(--danger)", values: view.months.map((m) => byCode.get("233")?.byMonth[m]?.[3] ?? 0) }]}
            format={(v) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
          />
        </ChartCard>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">DRE resumido — {selectedLabel}</h2>
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border-strong bg-surface-muted text-[11px] uppercase tracking-wide text-foreground-subtle">
                <th className="px-3 py-2 text-left font-semibold">Conta</th>
                <th className="px-3 py-2 text-right font-semibold">Remunerado</th>
                <th className="px-3 py-2 text-right font-semibold">Realizado</th>
                <th className="px-3 py-2 text-right font-semibold">Diferença</th>
                <th className="px-3 py-2 text-right font-semibold">% da receita</th>
              </tr>
            </thead>
            <tbody>
              {summaryLines.map((l) => {
                const c = cellOf(l, selected);
                if (!c) return null;
                const bold = ["001", "157", "233", "273", "276"].includes(l.code);
                return (
                  <tr key={l.code} className={cn("border-b border-border last:border-b-0", bold && "bg-surface-muted font-semibold")}>
                    <td className="px-3 py-2 text-foreground">{l.name.replace(/^\(\s*[=\-+/ ]*\s*\)\s*/, "")}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground-muted">{money(c[0])}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">{money(c[1])}</td>
                    <td className={cn("px-3 py-2 text-right tabular-nums", c[2] < 0 ? "text-danger" : "text-foreground-muted")}>{money(c[2])}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground-muted">{percent(c[3])}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Evolução mês a mês (realizado)</h2>
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border-strong bg-surface-muted text-[11px] uppercase tracking-wide text-foreground-subtle">
                <th className="px-3 py-2 text-left font-semibold">Linha</th>
                {view.months.map((m) => (
                  <th key={m} className="px-3 py-2 text-right font-semibold">{shortName(m)}</th>
                ))}
                <th className="px-3 py-2 text-right font-semibold">Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {evolution.map((row, i) => (
                <tr key={i} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 text-foreground">
                    {row.label} <span className="text-[11px] text-foreground-subtle">{row.kind === "real" ? "(R$)" : "(% da receita)"}</span>
                  </td>
                  {[...view.months, "ytd"].map((m) => {
                    const c = cellOf(byCode.get(row.code), m);
                    const value = c ? (row.kind === "real" ? c[1] : row.negate ? -c[3] : c[3]) : null;
                    return (
                      <td key={m} className={cn("px-3 py-2 text-right tabular-nums", m === "ytd" && "font-semibold", value !== null && value < 0 && "text-danger")}>
                        {value === null ? "—" : row.kind === "real" ? money(value) : percent(value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">DRE detalhado — {selectedLabel}</h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(new Set(tree.filter((n) => n.hasChildren).map((n) => n.line.code)))} className="h-8 rounded-md border border-border-strong bg-surface px-3 text-xs font-medium text-foreground hover:bg-surface-muted">
              Abrir tudo
            </button>
            <button type="button" onClick={() => setOpen(new Set())} className="h-8 rounded-md border border-border-strong bg-surface px-3 text-xs font-medium text-foreground hover:bg-surface-muted">
              Fechar tudo
            </button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border-strong bg-surface-muted text-[11px] uppercase tracking-wide text-foreground-subtle">
                <th className="px-3 py-2 text-left font-semibold">Conta</th>
                <th className="px-3 py-2 text-right font-semibold">Remunerado</th>
                <th className="px-3 py-2 text-right font-semibold">Realizado</th>
                <th className="px-3 py-2 text-right font-semibold">Diferença</th>
                <th className="px-3 py-2 text-right font-semibold">% da receita</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ line: l, hasChildren }) => {
                const c = cellOf(l, selected);
                if (!c) return null;
                return (
                  <tr
                    key={l.code}
                    onClick={hasChildren ? () => toggle(l.code) : undefined}
                    className={cn("border-b border-border last:border-b-0", l.level === 0 && "bg-surface-muted font-semibold", hasChildren && "cursor-pointer hover:bg-surface-muted")}
                  >
                    <td className="px-3 py-1.5 text-foreground" style={{ paddingLeft: 12 + l.level * 18 }}>
                      <span className="inline-flex items-center gap-1.5">
                        <ChevronRight className={cn("size-3.5 shrink-0 text-foreground-subtle transition-transform", !hasChildren && "opacity-0", hasChildren && open.has(l.code) && "rotate-90")} />
                        {l.name.replace(/^\(\s*[=\-+/ ]*\s*\)\s*/, "")}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-foreground-muted">{money(c[0])}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-foreground">{money(c[1])}</td>
                    <td className={cn("px-3 py-1.5 text-right tabular-nums", c[2] < 0 ? "text-danger" : "text-foreground-muted")}>{money(c[2])}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-foreground-muted">{percent(c[3])}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-[11px] text-foreground-subtle">
          Só aparecem contas que tiveram valor em algum mês ({lines.length} de {view.lines.length}). Custos aparecem negativos, como no DRE original. Diferença = realizado − remunerado.
        </p>
      </section>
    </div>
  );
}

function ChartCard({ title, legend, children }: { title: string; legend: { label: string; color: string }[]; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <div className="flex gap-3 text-[11px] text-foreground-subtle">
          {legend.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-sm" style={{ background: l.color }} /> {l.label}
            </span>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}

/** Barras agrupadas por mês, com base no zero (valores negativos descem). Rótulo só da última série, pra não poluir. */
function BarChart({ labels, series, format }: { labels: string[]; series: { color: string; negativeColor?: string; values: number[] }[]; format: (v: number) => string }) {
  const W = 560;
  const H = 190;
  const top = 18;
  const bottom = 24;
  const all = series.flatMap((s) => s.values);
  const max = Math.max(...all, 0);
  const min = Math.min(...all, 0);
  const span = max - min || 1;
  const plotH = H - top - bottom;
  const y = (v: number) => top + ((max - v) / span) * plotH;
  const zero = y(0);
  const groupW = W / labels.length;
  const barW = Math.min(22, (groupW - 10) / series.length);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto h-auto max-h-56 w-full" role="img">
      <line x1={0} x2={W} y1={zero} y2={zero} stroke="var(--border-strong)" strokeWidth={1} />
      {labels.map((label, i) => {
        const gx = i * groupW + (groupW - barW * series.length) / 2;
        return (
          <g key={label}>
            {series.map((s, j) => {
              const v = s.values[i] ?? 0;
              const yy = y(v);
              const color = v < 0 && s.negativeColor ? s.negativeColor : s.color;
              return <rect key={j} x={gx + j * barW} y={Math.min(yy, zero)} width={barW - 2} height={Math.max(Math.abs(yy - zero), 1)} rx={2} fill={color} />;
            })}
            {(() => {
              const last = series[series.length - 1];
              const v = last.values[i] ?? 0;
              return (
                <text x={gx + (barW * series.length) / 2 - 1} y={(v >= 0 ? y(v) - 4 : y(v) + 11)} textAnchor="middle" fontSize={9} fill="var(--foreground-muted)">
                  {format(v)}
                </text>
              );
            })()}
            <text x={i * groupW + groupW / 2} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--foreground-subtle)">
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
