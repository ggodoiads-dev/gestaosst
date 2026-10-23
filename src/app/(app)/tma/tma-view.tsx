"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatDuration, TMA_TARGET_MIN, type GroupStat, type TmaStats } from "@/domain/tma/stats";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const monthName = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]}/${key.slice(0, 4)}`;
const pct = (v: number | null) => (v === null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);

type Props = { months: string[]; selected: string; year: number; month: TmaStats; ytd: TmaStats; importedAt: Date | null };

export function TmaViewClient({ months, selected, year, month, ytd, importedAt }: Props) {
  const router = useRouter();
  const within = month.avgTma !== null && month.avgTma <= TMA_TARGET_MIN;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <label className="flex flex-col gap-1 text-xs text-foreground-subtle">
          Mês
          <select value={selected} onChange={(e) => router.push(`/tma?periodo=${e.target.value}`)} className="h-9 min-w-48 rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground">
            {[...months].reverse().map((m) => (
              <option key={m} value={m}>{monthName(m)}</option>
            ))}
          </select>
        </label>
        <p className="text-xs text-foreground-subtle">
          Fonte: planilha de controle de atendimento (Ambev). TMA = coluna TMA dos caminhões liberados com agendamento.
          {importedAt && <> Última importação em {new Date(importedAt).toLocaleDateString("pt-BR")}.</>}
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">{monthName(selected)}</h2>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Tile label="Carros carregados" value={String(month.carregados.total)} sub={`${month.carregados.withSchedule} com agendamento · ${month.carregados.withoutSchedule} sem`} tone="neutral" />
          <Tile label="TMA — planilha da Ambev" value={formatDuration(month.avgTma)} sub={`meta ${formatDuration(TMA_TARGET_MIN)} · liberados com agendamento`} tone={month.avgTma === null ? "neutral" : within ? "good" : "bad"} />
          <Tile label="Com TMA em até 3h" value={pct(month.within3h)} sub={`${month.loaded} caminhões na média`} tone="neutral" />
          <Tile label="TMC — carregamento" value={formatDuration(month.avgTmc)} sub="início → fim do carregamento" tone="neutral" />
        </div>
        <p className="mt-1.5 text-[11px] text-foreground-subtle">
          Carros carregados = liberados dentro do mês (pela data de liberação), com e sem agendamento. A média do TMA usa só os que tinham agendamento ({month.loaded} caminhões, que
          podem incluir carros da aba liberados no mês seguinte{month.carregados.outsideMonth > 0 ? `; ${month.carregados.outsideMonth} liberado(s) da aba ficaram fora da contagem de carregados por terem liberação em outro mês ou sem data` : ""}).
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-5">
          <Tile label="Carros amarrados" value={String(month.amarrados.total)} sub={`${pct(month.carregados.total === 0 ? null : Math.round((month.amarrados.total / month.carregados.total) * 1000) / 10)} dos carregados · tempo médio ${formatDuration(month.amarrados.avgAmarracao)}`} tone="neutral" small />
          <Tile label="Tempo de atendimento" value={formatDuration(month.atendimento.avg)} sub={`entrada no atendimento → liberação · ${pct(month.atendimento.within3h)} em até 3h`} tone="neutral" small />
          <Tile label="Com agendamento" value={pct(month.withSchedule)} sub={month.onTime === null ? undefined : `${pct(month.onTime)} no horário ou antes`} tone="neutral" small />
          <Tile label="Não apresentaram" value={String(month.notShown)} sub={`${month.holes} furo(s) · ${month.releasedMaster} liberados master (fora da média)`} tone="neutral" small />
          <Tile label={`Acumulado de ${year}`} value={formatDuration(ytd.avgTma)} sub={`${pct(ytd.within3h)} em até 3h · ${ytd.loaded} caminhões`} tone={ytd.avgTma === null ? "neutral" : ytd.avgTma <= TMA_TARGET_MIN ? "good" : "bad"} small />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-md border border-border bg-surface p-3 xl:col-span-2">
          <h3 className="mb-2 text-sm font-semibold text-foreground">TMA médio por dia de liberação</h3>
          <DailyChart days={month.byDay} />
        </div>
        <div className="rounded-md border border-border bg-surface p-3">
          <h3 className="mb-1 text-sm font-semibold text-foreground">Onde o tempo é gasto</h3>
          <p className="mb-3 text-[11px] text-foreground-subtle">Média de cada etapa. As quatro últimas formam o tempo de atendimento (da entrada à liberação); o pátio acontece antes e só entra no TMA de quem chega no horário ou antes.</p>
          <Stages stages={month.stages} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <AmarracaoTable rows={month.amarrados.byTurno} total={month.amarrados.total} loaded={month.carregados.total} />
        <GroupTable title="Por transportadora" rows={month.byTransportadora} />
        <GroupTable title="Por destino" rows={month.byDestino} />
        <GroupTable title="Por conferente" rows={month.byConferente} />
        <GroupTable title="Por turno" rows={month.byTurno} />
      </section>
    </div>
  );
}

function Tile({ label, value, sub, tone, small }: { label: string; value: string; sub?: string; tone: "good" | "bad" | "neutral"; small?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-foreground-subtle">{label}</p>
      <p className={cn("mt-0.5 font-semibold tabular-nums", small ? "text-lg" : "text-2xl", tone === "good" && "text-success", tone === "bad" && "text-danger", tone === "neutral" && "text-foreground")}>{value}</p>
      {sub && <p className="text-[11px] text-foreground-subtle">{sub}</p>}
    </div>
  );
}

function DailyChart({ days }: { days: { day: string; count: number; avgTma: number | null }[] }) {
  if (days.length === 0) return <p className="py-8 text-center text-sm text-foreground-subtle">Sem caminhões liberados neste mês.</p>;
  const W = 720;
  const H = 210;
  const top = 18;
  const bottom = 26;
  const values = days.map((d) => d.avgTma ?? 0);
  const max = Math.max(...values, TMA_TARGET_MIN) * 1.1;
  const plotH = H - top - bottom;
  const y = (v: number) => top + (1 - v / max) * plotH;
  const groupW = W / days.length;
  const barW = Math.min(26, groupW - 4);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto max-h-64 w-full" role="img">
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--border-strong)" />
      <line x1={0} x2={W} y1={y(TMA_TARGET_MIN)} y2={y(TMA_TARGET_MIN)} stroke="var(--danger)" strokeDasharray="4 3" strokeWidth={1} />
      <text x={W - 2} y={y(TMA_TARGET_MIN) - 3} textAnchor="end" fontSize={9} fill="var(--danger)">meta 3:00</text>
      {days.map((d, i) => {
        const v = d.avgTma ?? 0;
        const x = i * groupW + (groupW - barW) / 2;
        return (
          <g key={d.day}>
            <rect x={x} y={y(v)} width={barW} height={Math.max(y(0) - y(v), 1)} rx={2} fill={v <= TMA_TARGET_MIN ? "var(--success)" : "var(--accent)"} />
            {days.length <= 24 && <text x={x + barW / 2} y={y(v) - 3} textAnchor="middle" fontSize={8} fill="var(--foreground-muted)">{formatDuration(v)}</text>}
            <text x={i * groupW + groupW / 2} y={H - 9} textAnchor="middle" fontSize={9} fill="var(--foreground-subtle)">{d.day.slice(8)}</text>
          </g>
        );
      })}
    </svg>
  );
}

const STAGE_LABELS: { key: keyof TmaStats["stages"]; label: string; inTma: boolean }[] = [
  { key: "patio", label: "Pátio (antes de entrar)", inTma: false },
  { key: "espera", label: "Espera no armazém", inTma: true },
  { key: "carregamento", label: "Carregamento (TMC)", inTma: true },
  { key: "amarracao", label: "Amarração", inTma: true },
  { key: "liberacao", label: "Liberação", inTma: true },
];

function Stages({ stages }: { stages: TmaStats["stages"] }) {
  const inTmaTotal = STAGE_LABELS.filter((s) => s.inTma).reduce((sum, s) => sum + (stages[s.key] ?? 0), 0);
  const max = Math.max(...STAGE_LABELS.map((s) => stages[s.key] ?? 0), 1);
  return (
    <ul className="flex flex-col gap-2.5">
      {STAGE_LABELS.map((s) => {
        const v = stages[s.key];
        return (
          <li key={s.key}>
            <div className="flex items-baseline justify-between text-xs">
              <span className={cn("text-foreground", !s.inTma && "text-foreground-subtle")}>{s.label}</span>
              <span className="tabular-nums font-semibold text-foreground">
                {formatDuration(v)}
                {s.inTma && v !== null && inTmaTotal > 0 && <span className="ml-1 font-normal text-foreground-subtle">({Math.round((v / inTmaTotal) * 100)}%)</span>}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-soft">
              <div className={cn("h-full rounded-full", s.inTma ? "bg-accent" : "bg-border-strong")} style={{ width: `${Math.max(((v ?? 0) / max) * 100, v ? 2 : 0)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function AmarracaoTable({ rows, total, loaded }: { rows: TmaStats["amarrados"]["byTurno"]; total: number; loaded: number }) {
  const max = Math.max(...rows.map((r) => r.tied), 1);
  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      <h3 className="border-b border-border bg-surface-muted px-3 py-2 text-sm font-semibold text-foreground">Carros amarrados por turno</h3>
      <p className="px-3 pt-2 text-[11px] text-foreground-subtle">
        Vem da planilha: carro carregado no mês com a hora de fim da amarração preenchida ({total} de {loaded}). O tempo é do fim do carregamento ao fim da amarração.
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] uppercase tracking-wide text-foreground-subtle">
            <th className="px-3 py-1.5 text-left font-semibold">Turno</th>
            <th className="px-3 py-1.5 text-left font-semibold">Amarrados</th>
            <th className="px-3 py-1.5 text-right font-semibold">Carregados</th>
            <th className="px-3 py-1.5 text-right font-semibold">Tempo médio</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-border last:border-b-0">
              <td className="px-3 py-1.5 text-foreground">{r.name === "(sem informação)" ? r.name : `Turno ${r.name}`}</td>
              <td className="px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-soft">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${(r.tied / max) * 100}%` }} />
                  </div>
                  <span className="tabular-nums font-medium text-foreground">{r.tied}</span>
                </div>
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums text-foreground-muted">{r.loaded}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-foreground-muted">{formatDuration(r.avgAmarracao)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-5 text-center text-foreground-subtle">Sem dados.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function GroupTable({ title, rows }: { title: string; rows: GroupStat[] }) {
  const shown = rows.slice(0, 12);
  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      <h3 className="border-b border-border bg-surface-muted px-3 py-2 text-sm font-semibold text-foreground">{title}</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] uppercase tracking-wide text-foreground-subtle">
            <th className="px-3 py-1.5 text-left font-semibold">Nome</th>
            <th className="px-3 py-1.5 text-right font-semibold">Liberados</th>
            <th className="px-3 py-1.5 text-right font-semibold">TMA médio</th>
            <th className="px-3 py-1.5 text-right font-semibold">Até 3h</th>
            <th className="px-3 py-1.5 text-right font-semibold">Amarração</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.name} className="border-b border-border last:border-b-0">
              <td className="px-3 py-1.5 text-foreground">{r.name}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-foreground-muted">{r.count}</td>
              <td className={cn("px-3 py-1.5 text-right tabular-nums font-medium", r.avgTma !== null && r.avgTma > TMA_TARGET_MIN ? "text-danger" : "text-success")}>{formatDuration(r.avgTma)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-foreground-muted">{pct(r.within3h)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-foreground-muted">{formatDuration(r.avgAmarracao)}</td>
            </tr>
          ))}
          {shown.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-5 text-center text-foreground-subtle">Sem dados.</td>
            </tr>
          )}
        </tbody>
      </table>
      {rows.length > shown.length && <p className="px-3 py-1.5 text-[11px] text-foreground-subtle">Mostrando os {shown.length} com mais caminhões, de {rows.length}.</p>}
    </div>
  );
}
