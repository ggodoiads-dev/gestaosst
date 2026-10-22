"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PRODUCTION_GROUPS, fieldsOfGroup, totalOfGroup } from "@/domain/production/fields";
import type { ProductionStats, ShiftReport, TurnoStat } from "@/domain/production/stats";
import { deleteShiftProductionAction } from "@/server/actions/production.actions";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const monthName = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]}/${key.slice(0, 4)}`;
const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: 1 }));
const dayLabel = (day: string) => `${day.slice(8)}/${day.slice(5, 7)}`;

type Props = {
  months: string[];
  selected: string;
  year: number;
  month: ProductionStats;
  ytd: ProductionStats;
  reports: ShiftReport[];
  canLog: boolean;
};

export function ProductionViewClient({ months, selected, year, month, ytd, reports, canLog }: Props) {
  const router = useRouter();
  const t = month.totals;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <label className="flex flex-col gap-1 text-xs text-foreground-subtle">
          Mês
          <select value={selected} onChange={(e) => router.push(`/producao?periodo=${e.target.value}`)} className="h-9 min-w-48 rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground">
            {[...months].reverse().map((m) => (
              <option key={m} value={m}>{monthName(m)}</option>
            ))}
          </select>
        </label>
        <p className="text-xs text-foreground-subtle">
          Fonte: relatório de fim de turno lançado pelo líder (um por dia e turno). {month.reports} relatório(s) em {month.daysWithReport} dia(s).
        </p>
      </div>

      {month.reports === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong bg-surface px-4 py-10 text-center text-sm text-foreground-subtle">
          Nenhum relatório de turno lançado em {monthName(selected)}.
        </div>
      ) : (
        <>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-foreground">{monthName(selected)}</h2>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
              <Tile label="Carros carregados" value={fmt(t.carrosCarregados)} sub={month.avgLoadedPerDay === null ? undefined : `média de ${fmt(month.avgLoadedPerDay)} por dia`} />
              <Tile label="Carros trabalhados" value={fmt(t.carrosTrabalhados)} sub={month.loadedRate === null ? undefined : `${fmt(month.loadedRate)}% foram carregados`} />
              <Tile label={`Acumulado de ${year}`} value={fmt(ytd.totals.carrosCarregados)} sub={`carros carregados · ${ytd.daysWithReport} dia(s)`} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Tile label="Itens carregados" value={fmt(month.cargasTotal)} sub="almox + pallets + quadros + chapatex + bulks" small />
              <Tile label="Itens descarregados" value={fmt(month.descargasTotal)} sub="bulk, quadro, chapatex, pallets, insumos, devoluções, almox" small />
              <Tile label="Queda de produto" value={fmt(t.quedaProduto)} sub={`${fmt(t.absOperador)} ABS de operador`} small />
              <Tile label="Fila de carregamento" value={fmt(t.filaCarregamento)} sub={`${fmt(t.ajusteCarros)} de ajuste de carros`} small />
            </div>
            {(t.selecaoTotalChapas !== undefined || t.selecaoPalletsSelecionados !== undefined) && (
              <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
                <Tile label="Total de chapas (seleção)" value={fmt(t.selecaoTotalChapas)} sub={`${fmt(t.selecaoChapaDpvim)} DPVIM · ${fmt(t.selecaoTransferencia)} em transferência`} small />
                <Tile label="Pallets selecionados" value={fmt(t.selecaoPalletsSelecionados)} sub="fechamento dos ajudantes" small />
                <Tile label="Reforma" value={fmt(t.selecaoReforma)} sub={`${fmt(t.selecaoBom)} bons · ${fmt(t.selecaoDescarte)} descartados`} small />
                <Tile label="Quebra" value={fmt(t.selecaoQuebra)} sub="chapas e pallets quebrados" small />
              </div>
            )}
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="rounded-md border border-border bg-surface p-3 xl:col-span-2">
              <h3 className="mb-1 text-sm font-semibold text-foreground">Carros por dia</h3>
              <p className="mb-2 text-[11px] text-foreground-subtle">Soma dos turnos do dia. Barra azul = carregados; o número cinza acima, com contorno, = trabalhados.</p>
              <DailyChart days={month.byDay} />
            </div>
            <div className="rounded-md border border-border bg-surface p-3">
              <h3 className="mb-1 text-sm font-semibold text-foreground">Carros carregados por turno</h3>
              <p className="mb-3 text-[11px] text-foreground-subtle">Total do mês e média por relatório lançado.</p>
              <TurnoBars turnos={month.byTurno} metric="carrosCarregados" />
              <h3 className="mb-1 mt-5 border-t border-border pt-3 text-sm font-semibold text-foreground">Carros amarrados por turno</h3>
              <p className="mb-3 text-[11px] text-foreground-subtle">Quem amarra mais. Soma só dos relatórios em que o campo foi preenchido.</p>
              <TurnoBars turnos={month.byTurno} metric="carrosAmarrados" />
            </div>
          </section>

          <TurnoTable turnos={month.byTurno} />

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {PRODUCTION_GROUPS.map((g) => (
              <div key={g.key} className="overflow-hidden rounded-md border border-border bg-surface">
                <h3 className="border-b border-border bg-surface-muted px-3 py-2 text-sm font-semibold text-foreground">{g.label}</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase tracking-wide text-foreground-subtle">
                      <th className="px-3 py-1.5 text-left font-semibold">Item</th>
                      <th className="px-3 py-1.5 text-right font-semibold">{monthName(selected).split("/")[0]}</th>
                      <th className="px-3 py-1.5 text-right font-semibold">{year}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fieldsOfGroup(g.key).map((f) => (
                      <tr key={f.key} className="border-b border-border last:border-b-0">
                        <td className="px-3 py-1.5 text-foreground">{f.label}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums font-medium text-foreground">{fmt(t[f.key])}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-foreground-muted">{fmt(ytd.totals[f.key])}</td>
                      </tr>
                    ))}
                    {(g.key === "CARGAS" || g.key === "DESCARGAS") && (
                      <tr className="bg-surface-muted">
                        <td className="px-3 py-1.5 font-semibold text-foreground">Total</td>
                        <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-foreground">{fmt(totalOfGroup(t, g.key))}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-foreground-muted">{fmt(totalOfGroup(ytd.totals, g.key))}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ))}
          </section>

          <ReportLog reports={reports} canLog={canLog} />
        </>
      )}
    </div>
  );
}

function Tile({ label, value, sub, small }: { label: string; value: string; sub?: string; small?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-foreground-subtle">{label}</p>
      <p className={cn("mt-0.5 font-semibold tabular-nums text-foreground", small ? "text-lg" : "text-2xl")}>{value}</p>
      {sub && <p className="text-[11px] text-foreground-subtle">{sub}</p>}
    </div>
  );
}

function DailyChart({ days }: { days: ProductionStats["byDay"] }) {
  const W = 720;
  const H = 210;
  const top = 18;
  const bottom = 26;
  const max = Math.max(...days.map((d) => Math.max(d.carrosCarregados, d.carrosTrabalhados)), 1) * 1.15;
  const plotH = H - top - bottom;
  const y = (v: number) => top + (1 - v / max) * plotH;
  const groupW = W / Math.max(days.length, 1);
  const barW = Math.min(26, groupW - 4);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto max-h-64 w-full" role="img" aria-label="Carros carregados e trabalhados por dia">
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--border-strong)" />
      {days.map((d, i) => {
        const x = i * groupW + (groupW - barW) / 2;
        return (
          <g key={d.day}>
            {d.carrosTrabalhados > 0 && <rect x={x} y={y(d.carrosTrabalhados)} width={barW} height={Math.max(y(0) - y(d.carrosTrabalhados), 1)} rx={2} fill="none" stroke="var(--border-strong)" />}
            <rect x={x} y={y(d.carrosCarregados)} width={barW} height={Math.max(y(0) - y(d.carrosCarregados), 1)} rx={2} fill="var(--accent)" />
            {days.length <= 24 && (
              <>
                {d.carrosTrabalhados > d.carrosCarregados && <text x={x + barW / 2} y={y(d.carrosTrabalhados) - 3} textAnchor="middle" fontSize={8} fill="var(--foreground-subtle)">{d.carrosTrabalhados}</text>}
                <text x={x + barW / 2} y={y(d.carrosCarregados) + 11} textAnchor="middle" fontSize={9} fontWeight={600} fill="#fff">{d.carrosCarregados}</text>
              </>
            )}
            <text x={i * groupW + groupW / 2} y={H - 9} textAnchor="middle" fontSize={9} fill="var(--foreground-subtle)">{d.day.slice(8)}</text>
          </g>
        );
      })}
    </svg>
  );
}

function TurnoBars({ turnos, metric }: { turnos: TurnoStat[]; metric: string }) {
  const rows = turnos.map((t) => ({ turno: t.turno, total: t.totals[metric] ?? 0, avg: t.reports > 0 ? (t.totals[metric] ?? 0) / t.reports : 0 }));
  const max = Math.max(...rows.map((r) => r.total), 1);
  const sum = rows.reduce((s, r) => s + r.total, 0);
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.turno}>
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-medium text-foreground">Turno {r.turno}</span>
            <span className="tabular-nums text-foreground">
              <span className="font-semibold">{fmt(r.total)}</span>
              {sum > 0 && <span className="ml-1 text-foreground-subtle">({Math.round((r.total / sum) * 100)}%)</span>}
              <span className="ml-2 text-foreground-subtle">{fmt(Math.round(r.avg * 10) / 10)}/relatório</span>
            </span>
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-neutral-soft">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max((r.total / max) * 100, r.total ? 2 : 0)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const TURNO_COLUMNS: { key: string; label: string }[] = [
  { key: "carrosTrabalhados", label: "Trabalhados" },
  { key: "carrosAmarrados", label: "Amarrados" },
  { key: "carrosCarregados", label: "Carregados" },
  { key: "preCargaTotal", label: "Pré-carga" },
  { key: "quedaProduto", label: "Queda" },
  { key: "absOperador", label: "ABS" },
];

function TurnoTable({ turnos }: { turnos: TurnoStat[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-surface">
      <h3 className="border-b border-border bg-surface-muted px-3 py-2 text-sm font-semibold text-foreground">Comparativo entre turnos</h3>
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] uppercase tracking-wide text-foreground-subtle">
            <th className="px-3 py-1.5 text-left font-semibold">Turno</th>
            <th className="px-3 py-1.5 text-right font-semibold">Relatórios</th>
            {TURNO_COLUMNS.map((c) => (
              <th key={c.key} className="px-3 py-1.5 text-right font-semibold">{c.label}</th>
            ))}
            <th className="px-3 py-1.5 text-right font-semibold">Itens carregados</th>
            <th className="px-3 py-1.5 text-right font-semibold">Itens descarregados</th>
          </tr>
        </thead>
        <tbody>
          {turnos.map((tu) => (
            <tr key={tu.turno} className="border-b border-border last:border-b-0">
              <td className="px-3 py-1.5 font-medium text-foreground">Turno {tu.turno}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-foreground-muted">{tu.reports}</td>
              {TURNO_COLUMNS.map((c) => (
                <td key={c.key} className={cn("px-3 py-1.5 text-right tabular-nums", c.key === "carrosCarregados" ? "font-semibold text-foreground" : "text-foreground-muted")}>{fmt(tu.totals[c.key])}</td>
              ))}
              <td className="px-3 py-1.5 text-right tabular-nums text-foreground-muted">{fmt(totalOfGroup(tu.totals, "CARGAS"))}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-foreground-muted">{fmt(totalOfGroup(tu.totals, "DESCARGAS"))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportLog({ reports, canLog }: { reports: ShiftReport[]; canLog: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);
  const sorted = [...reports].sort((a, b) => b.day.localeCompare(a.day) || a.turno.localeCompare(b.turno, "pt-BR"));

  function remove(id: string) {
    if (!window.confirm("Apagar este relatório de turno?")) return;
    start(async () => {
      const res = await deleteShiftProductionAction(id);
      if (res.ok) {
        toast.success("Relatório apagado.");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      <h3 className="border-b border-border bg-surface-muted px-3 py-2 text-sm font-semibold text-foreground">Relatórios lançados</h3>
      <ul>
        {sorted.map((r) => {
          const open = openId === r.id;
          return (
            <li key={r.id} className="border-b border-border last:border-b-0">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm">
                <button type="button" onClick={() => setOpenId(open ? null : r.id)} className="flex min-w-40 items-center gap-2 text-left font-medium text-foreground hover:text-accent">
                  {dayLabel(r.day)} · Turno {r.turno}
                </button>
                <span className="tabular-nums text-foreground-muted">{fmt(r.values.carrosCarregados)} carregados</span>
                <span className="tabular-nums text-foreground-muted">{fmt(r.values.carrosTrabalhados)} trabalhados</span>
                <span className="tabular-nums text-foreground-muted">{fmt(r.values.carrosAmarrados)} amarrados</span>
                {r.notes && <span className="text-[11px] text-foreground-subtle">com observações</span>}
                <span className="ml-auto flex items-center gap-3">
                  {canLog && (
                    <a href={`/producao/lancar?dia=${r.day}&turno=${encodeURIComponent(r.turno)}`} className="text-xs font-medium text-accent hover:underline">Editar</a>
                  )}
                  {canLog && (
                    <button type="button" disabled={pending} onClick={() => remove(r.id)} className="text-foreground-subtle hover:text-danger" aria-label="Apagar relatório">
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </span>
              </div>
              {open && (
                <div className="border-t border-border bg-surface-muted px-3 py-3">
                  <div className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-3">
                    {PRODUCTION_GROUPS.map((g) => (
                      <dl key={g.key} className="text-xs">
                        <dt className="mb-1 font-semibold uppercase tracking-wide text-foreground-subtle">{g.label}</dt>
                        {fieldsOfGroup(g.key)
                          .filter((f) => r.values[f.key] !== undefined)
                          .map((f) => (
                            <dd key={f.key} className="flex justify-between gap-3 py-0.5">
                              <span className="text-foreground-muted">{f.label}</span>
                              <span className="tabular-nums font-medium text-foreground">{r.values[f.key]}</span>
                            </dd>
                          ))}
                      </dl>
                    ))}
                  </div>
                  {r.notes && (
                    <div className="mt-3 text-xs">
                      <p className="mb-1 font-semibold uppercase tracking-wide text-foreground-subtle">Observações</p>
                      <p className="whitespace-pre-line text-foreground">{r.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
