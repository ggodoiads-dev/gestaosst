"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { DreCell, DreView, DreViewLine } from "@/server/services/dre.service";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const money = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percent = (v: number | null) => (v === null || !Number.isFinite(v) ? "—" : `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`);
const monthName = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]}/${key.slice(0, 4)}`;

export function DreViewClient({ view }: { view: DreView }) {
  const [selected, setSelected] = useState<string>("ytd");
  const [detail, setDetail] = useState(2);
  const [hideZero, setHideZero] = useState(true);

  const byCode = useMemo(() => new Map(view.lines.map((l) => [l.code, l])), [view.lines]);
  const cellOf = (l: DreViewLine | undefined, key: string): DreCell | null => (!l ? null : key === "ytd" ? l.ytd : (l.byMonth[key] ?? null));

  const kpis = useMemo(() => {
    const revenue = cellOf(byCode.get("001"), selected);
    const avr = (code: string, negate = false) => {
      const c = cellOf(byCode.get(code), selected);
      return c ? (negate ? -c[3] : c[3]) : null;
    };
    const personnel = cellOf(byCode.get("033"), selected);
    return [
      { label: "Receita líquida", value: revenue ? `R$ ${money(revenue[1])}` : "—", sub: revenue ? `remunerado R$ ${money(revenue[0])}` : "" },
      { label: "EBITDA", value: avr("233") === null ? "—" : percent(avr("233")), sub: cellOf(byCode.get("233"), selected) ? `R$ ${money(cellOf(byCode.get("233"), selected)![1])}` : "" },
      { label: "Gastos totais", value: percent(avr("021", true)), sub: "custos operacionais ÷ receita" },
      { label: "Despesas administrativas", value: percent(avr("158", true)), sub: "÷ receita líquida" },
      { label: "Pacote de manutenção", value: percent(avr("114")), sub: "custos gerais com frota ÷ receita" },
      { label: "Pacote de gente", value: personnel && personnel[0] !== 0 ? percent((personnel[1] / personnel[0]) * 100) : "—", sub: "custo com pessoal: realizado ÷ remunerado" },
    ];
  }, [byCode, selected]);

  const evolution = [
    { label: "Receita líquida (R$)", code: "001", kind: "real" as const },
    { label: "Custos operacionais (% da receita)", code: "021", kind: "avr" as const },
    { label: "Lucro operacional (R$)", code: "157", kind: "real" as const },
    { label: "Despesas administrativas (% da receita)", code: "158", kind: "avr" as const },
    { label: "EBITDA (R$)", code: "233", kind: "real" as const },
    { label: "EBITDA (% da receita)", code: "233", kind: "avr" as const },
  ];

  const visible = view.lines.filter((l) => {
    if (l.level + 1 > detail) return false;
    if (!hideZero) return true;
    const c = cellOf(l, selected);
    return !!c && (Math.abs(c[0]) >= 0.005 || Math.abs(c[1]) >= 0.005);
  });

  const selectedLabel = selected === "ytd" ? `Acumulado de janeiro a ${MONTHS[Number(view.months[view.months.length - 1].slice(5, 7)) - 1]}/${view.year}` : monthName(selected);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-foreground-subtle">
        {view.meta?.unit && <span>Unidade: <strong className="text-foreground-muted">{view.meta.unit}</strong></span>}
        {view.meta?.officialAt && <span>Oficial atualizado em: <strong className="text-foreground-muted">{view.meta.officialAt}</strong></span>}
        {view.meta?.importedAt && <span>Importado em: <strong className="text-foreground-muted">{new Date(view.meta.importedAt).toLocaleDateString("pt-BR")}</strong></span>}
        <span>Meses disponíveis: <strong className="text-foreground-muted">{view.months.map((m) => MONTHS_SHORT[Number(m.slice(5, 7)) - 1]).join(", ")}/{view.year}</strong></span>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-xs text-foreground-subtle">
          Período
          <select value={selected} onChange={(e) => setSelected(e.target.value)} className="h-9 rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground">
            <option value="ytd">Acumulado do ano (YTD)</option>
            {[...view.months].reverse().map((m) => (
              <option key={m} value={m}>{monthName(m)}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-foreground-subtle">
          Nível de detalhe
          <select value={detail} onChange={(e) => setDetail(Number(e.target.value))} className="h-9 rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground">
            <option value={1}>1 — Só os totais</option>
            <option value={2}>2 — Grupos</option>
            <option value={3}>3 — Contas</option>
            <option value={5}>Tudo</option>
          </select>
        </label>
        <label className="flex h-9 items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} className="size-4 accent-[var(--accent)]" />
          Ocultar contas zeradas
        </label>
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

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Evolução mês a mês (realizado)</h2>
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border-strong bg-surface-muted text-[11px] uppercase tracking-wide text-foreground-subtle">
                <th className="px-3 py-2 text-left font-semibold">Linha</th>
                {view.months.map((m) => (
                  <th key={m} className="px-3 py-2 text-right font-semibold">{MONTHS_SHORT[Number(m.slice(5, 7)) - 1]}</th>
                ))}
                <th className="px-3 py-2 text-right font-semibold">Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {evolution.map((row, i) => (
                <tr key={i} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 text-foreground">{row.label}</td>
                  {[...view.months, "ytd"].map((m) => {
                    const c = cellOf(byCode.get(row.code), m);
                    return (
                      <td key={m} className={cn("px-3 py-2 text-right tabular-nums", m === "ytd" && "font-semibold", c && (row.kind === "real" ? c[1] : c[3]) < 0 && row.code !== "021" && row.code !== "158" && "text-danger")}>
                        {c ? (row.kind === "real" ? money(c[1]) : percent(row.code === "021" || row.code === "158" ? -c[3] : c[3])) : "—"}
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
        <h2 className="mb-2 text-sm font-semibold text-foreground">DRE completo — {selectedLabel}</h2>
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
              {visible.map((l) => {
                const c = cellOf(l, selected);
                if (!c) return null;
                return (
                  <tr key={l.code} className={cn("border-b border-border last:border-b-0", l.level === 0 && "bg-surface-muted font-semibold")}>
                    <td className="px-3 py-1.5 text-foreground" style={{ paddingLeft: 12 + l.level * 18 }}>
                      <span className="mr-2 font-mono text-[11px] text-foreground-subtle">{l.code}</span>
                      {l.name}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-foreground-muted">{money(c[0])}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-foreground">{money(c[1])}</td>
                    <td className={cn("px-3 py-1.5 text-right tabular-nums", c[2] < 0 ? "text-danger" : "text-foreground-muted")}>{money(c[2])}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-foreground-muted">{percent(c[3])}</td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-foreground-subtle">Nenhuma conta com esse filtro.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-[11px] text-foreground-subtle">Custos aparecem negativos, como no DRE original. Diferença = realizado − remunerado.</p>
      </section>
    </div>
  );
}
