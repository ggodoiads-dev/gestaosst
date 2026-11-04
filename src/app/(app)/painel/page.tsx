import { Greeting } from "@/components/domain/greeting";
import { greetingNow } from "@/lib/greeting";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { requireUser, hasPermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { getUiTheme } from "@/lib/ui-theme";
import { buildMonthlyReport, monthLabelOf, shiftMonth } from "@/server/services/report.service";
import { buildDetailedReport } from "@/server/services/report-detail.service";
import { getPdcaView } from "@/server/services/pdca.service";
import { listAlerts } from "@/server/services/daily-digest.service";
import { APP_TIMEZONE } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Kpi, MonthlyReport, ReportSection, Tone } from "@/domain/reports/types";
import { ALERT_SEVERITY_LABEL, type SystemAlert } from "@/domain/alerts/rules";
import { SeriesBars } from "../relatorios/report-charts";
import { HomeNovo } from "../inicio/home-novo";
import { HomeTabs } from "../inicio/home-tabs";
import { loadHomeNovoProps, loadQuickLinks } from "../inicio/load-home-data";
import { buildHeadline, type MarkTone } from "@/domain/home/headline";
import { formatLongDate } from "@/lib/dates";
import { LineChart, Ring, Sparkline } from "./charts";

const TONE_TEXT: Record<Tone, string> = { good: "text-success", bad: "text-danger", warn: "text-warning", neutral: "text-foreground-muted" };
const MARK: Record<MarkTone, string> = { mint: "#c8f0d6", sky: "#c4e4ff", lemon: "#fbeba0", rose: "#ffd5d5" };
const SEV_DOT = { CRITICO: "#d6342c", ALTO: "#e0a21b", ATENCAO: "#0068d8", INFO: "#7d8696" } as const;

function KpiCard({ k }: { k: Kpi }) {
  return (
    <section className="flex flex-col justify-between rounded-[20px] border border-border bg-surface p-4">
      <p className="text-[11.5px] font-semibold uppercase leading-snug tracking-[0.08em] text-foreground-muted">{k.label}</p>
      <p className="mt-3 text-[38px] font-semibold leading-none tracking-[-0.045em] text-foreground">{k.value}</p>
      <div className="mt-3 min-h-8">
        {k.delta && <p className={cn("text-[12.5px] font-medium", TONE_TEXT[k.tone])}>{k.delta}</p>}
        {k.note && <p className="text-[12px] text-foreground-subtle">{k.note}</p>}
      </div>
    </section>
  );
}

function SectionCard({ s }: { s: ReportSection }) {
  const table = s.tables.find((t) => t.rows.length > 0 && t.columns.length <= 5);
  return (
    <section className="flex flex-col gap-4 rounded-[24px] border border-border bg-surface p-5">
      <div>
        <h3 className="text-[18px] font-semibold tracking-[-0.02em] text-foreground">{s.title}</h3>
        <p className="mt-0.5 text-[12.5px] leading-snug text-foreground-subtle">{s.scope}</p>
      </div>
      {s.kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {s.kpis.slice(0, 6).map((k) => (
            <div key={k.key} className="rounded-[14px] bg-surface-muted px-3 py-2.5">
              <p className="text-[11px] font-medium leading-snug text-foreground-muted">{k.label}</p>
              <p className="mt-1 text-[22px] font-semibold leading-none tracking-[-0.03em] text-foreground">{k.value}</p>
              {k.delta && <p className={cn("mt-1 text-[11.5px] font-medium", TONE_TEXT[k.tone])}>{k.delta}</p>}
            </div>
          ))}
        </div>
      )}
      {s.series.slice(0, 2).map((x) => (
        <SeriesBars key={x.title} series={x} />
      ))}
      {table && (
        <div className="overflow-hidden rounded-[14px] border border-border">
          <p className="border-b border-border bg-surface-muted px-3 py-1.5 text-[11.5px] font-semibold text-foreground-muted">{table.title}</p>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-foreground-subtle">
                {table.columns.map((c, i) => (
                  <th key={c} className={cn("px-3 py-1.5 font-medium", table.rightAlign?.includes(i) && "text-right")}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.slice(0, 5).map((r, ri) => (
                <tr key={ri} className="border-t border-border">
                  {r.map((c, ci) => (
                    <td key={ci} className={cn("px-3 py-1.5", table.rightAlign?.includes(ci) && "text-right tabular-nums")}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Findings({ report, alerts }: { report: MonthlyReport | null; alerts: SystemAlert[] }) {
  const items = [
    ...alerts.map((a) => ({ key: `a-${a.key}`, severity: a.severity as keyof typeof SEV_DOT, title: a.title, detail: a.detail, href: a.href, label: ALERT_SEVERITY_LABEL[a.severity] })),
    ...(report?.findings ?? []).slice(0, 6).map((f, i) => ({ key: `f-${i}`, severity: f.severity as keyof typeof SEV_DOT, title: f.title, detail: f.detail, href: "/relatorios", label: f.module })),
  ].slice(0, 8);
  return (
    <section className="rounded-[24px] border border-border bg-surface p-5">
      <h3 className="text-[18px] font-semibold tracking-[-0.02em]">Pontos críticos</h3>
      <p className="mt-0.5 text-[12.5px] text-foreground-subtle">Regras fixas do SIGO sobre os números do mês e os avisos de hoje.</p>
      {items.length === 0 ? (
        <p className="mt-4 text-[14px] text-foreground-muted">Nenhum ponto crítico agora.</p>
      ) : (
        <ol className="mt-2 flex flex-col">
          {items.map((it, i) => (
            <li key={it.key} className="grid grid-cols-[28px_1fr_auto] items-baseline gap-3 border-b border-border py-3 last:border-b-0">
              <span className="sigo-mono text-[11.5px] text-foreground-subtle">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <p className="flex items-center gap-2 text-[14.5px] font-semibold tracking-[-0.01em] text-foreground">
                  <span className="inline-block size-2 shrink-0 rounded-full" style={{ background: SEV_DOT[it.severity] }} aria-hidden />
                  {it.title}
                </p>
                <p className="mt-0.5 text-[12.5px] text-foreground-muted">
                  <span className="font-medium">{it.label}.</span> {it.detail}
                </p>
              </div>
              <Link href={it.href} className="text-[12.5px] font-semibold text-accent hover:underline">
                Abrir →
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default async function PainelPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const user = await requireUser();
  if ((await getUiTheme()) !== "novo") redirect("/inicio");
  const { mes } = await searchParams;

  // Sem a visão consolidada, o painel é a versão simples (números da própria pessoa).
  if (!hasPermission(user, PERMISSIONS.INDICATORS_VIEW_CONSOLIDATED)) {
    const data = await loadHomeNovoProps(user);
    return (
      <div>
        <div className="flex justify-center px-4 pt-5">
          <HomeTabs active="painel" />
        </div>
        <HomeNovo {...data} />
      </div>
    );
  }

  const nowKey = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM");
  const month = mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) && mes <= nowKey ? mes : nowKey;
  const year = Number(month.slice(0, 4));
  const href = (m: string) => `/painel?mes=${m}`;

  const [quickLinks, report, pdca, attendance, alerts] = await Promise.all([
    loadQuickLinks(user),
    buildMonthlyReport(user, month, "interno").catch(() => null),
    hasPermission(user, PERMISSIONS.HR_MANAGE) ? getPdcaView(user, year).catch(() => null) : Promise.resolve(null),
    buildDetailedReport(user, "presenca", month, "interno").catch(() => null),
    month === nowKey ? listAlerts().catch(() => []) : Promise.resolve([]),
  ]);

  const turnoverSeries = pdca ? pdca.months.map((r) => ({ label: r.label, value: r.ytdRate })) : [];
  const turnoverNow = pdca?.current ?? null;
  const goal = pdca?.data.annualGoal ?? null;
  const executive = report?.executive ?? [];
  const checklistK = executive.find((k) => /checklist/i.test(k.label));
  const checklistPct = checklistK ? Number.parseInt(checklistK.value, 10) : null;

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <HomeTabs active="painel" />
        <div className="flex items-center gap-2">
          <Link href={href(shiftMonth(month, -1))} aria-label="Mês anterior" className="grid size-9 place-items-center rounded-full border border-border bg-surface hover:bg-surface-muted">
            <ChevronLeft className="size-4" />
          </Link>
          <span className="min-w-40 text-center text-[14px] font-semibold">{monthLabelOf(month)}</span>
          <Link
            href={href(shiftMonth(month, 1))}
            aria-label="Próximo mês"
            className={cn("grid size-9 place-items-center rounded-full border border-border bg-surface hover:bg-surface-muted", month >= nowKey && "pointer-events-none opacity-40")}
          >
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>

      <div>
        <p className="text-[13px] font-medium text-foreground-subtle">
          {month === nowKey ? (
            <>
              {formatLongDate(new Date())} · <Greeting initial={greetingNow()} lowercase />, {user.name.split(" ")[0]}
            </>
          ) : (
            `Painel de ${monthLabelOf(month)}`
          )}
        </p>
        <h1 className="mt-2 max-w-[900px] text-[34px] font-medium leading-[1.1] tracking-[-0.035em] text-foreground sm:text-[46px]">
          {buildHeadline({
            alertCount: alerts.length + (month === nowKey ? 0 : (report?.findings.length ?? 0)),
            criticalCount: month === nowKey ? alerts.filter((a) => a.severity === "CRITICO").length : (report?.findings.filter((f) => f.severity === "CRITICO").length ?? 0),
            checklistPct: checklistPct !== null && Number.isFinite(checklistPct) ? checklistPct : null,
            turnover: turnoverNow && turnoverNow.ytdRate !== null ? { rate: turnoverNow.ytdRate, goal } : null,
          }).map((part, i) => (
            <span key={i} className={cn(part.serif && "sigo-serif text-[1.08em]", part.mark && "sigo-mark")} style={part.mark ? ({ ["--mark" as string]: MARK[part.mark] } as React.CSSProperties) : undefined}>
              {part.text}
            </span>
          ))}
        </h1>
        {month === nowKey && <p className="mt-2 text-[13.5px] text-foreground-muted">Mês em andamento: os números são parciais e mudam a cada lançamento e importação.</p>}
      </div>

      {executive.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {executive.slice(0, 8).map((k) => (
            <KpiCard key={k.key} k={k} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.25fr_1fr]">
        <Findings report={report} alerts={alerts} />
        <div className="flex flex-col gap-4">
          {turnoverNow && (
            <section className="relative overflow-hidden rounded-[24px] bg-brand p-5 text-white">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#9db4dc]">Turnover acumulado do ano · {turnoverNow.label}</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="text-[64px] font-semibold leading-none tracking-[-0.05em]">
                  {String(turnoverNow.ytdRate ?? "—").replace(".", ",")}
                  <span className="ml-1 text-[24px] font-medium text-[#9db4dc]">%</span>
                </p>
                <Link href="/desligamentos/pdca" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#9db4dc] hover:text-white">
                  PDCA <ArrowUpRight className="size-4" />
                </Link>
              </div>
              <p className="mt-2 text-[13px] text-[#b9c8e6]">
                {goal !== null ? `Meta do ano ${String(goal).replace(".", ",")}%. ` : ""}
                {turnoverNow.ytdExits} demissão(ões) no ano ÷ QLP médio de {String(Math.round(turnoverNow.ytdQlp * 100) / 100).replace(".", ",")}. No mês: {String(turnoverNow.rate ?? "—").replace(".", ",")}%.
              </p>
            </section>
          )}
          {checklistPct !== null && Number.isFinite(checklistPct) && (
            <section className="flex items-center gap-5 rounded-[24px] border border-border bg-surface p-5">
              <Ring percent={checklistPct} tone={checklistPct >= 90 ? "good" : checklistPct >= 80 ? "warn" : "bad"} />
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">Aderência de checklist</p>
                <p className="mt-1 text-[13px] text-foreground-muted">Do mês, sobre os turnos em que alguém era cobrado.</p>
              </div>
            </section>
          )}
          {turnoverSeries.length > 0 && (
            <section className="rounded-[24px] border border-border bg-surface p-5">
              <LineChart title="Turnover acumulado do ano (%)" points={turnoverSeries} goal={goal} />
            </section>
          )}
        </div>
      </div>

      {report && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {report.sections.map((s) => (
            <SectionCard key={s.key} s={s} />
          ))}
        </div>
      )}

      {attendance && (
        <section className="rounded-[24px] border border-border bg-surface p-5">
          <h3 className="text-[18px] font-semibold tracking-[-0.02em]">Presença, faltas e atestados</h3>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            {attendance.executive.slice(0, 4).map((k) => (
              <div key={k.key} className="rounded-[14px] bg-surface-muted px-3 py-3">
                <p className="text-[11.5px] font-medium text-foreground-muted">{k.label}</p>
                <p className="mt-1 flex items-end justify-between gap-2 text-[28px] font-semibold leading-none tracking-[-0.04em]">
                  {k.value}
                  {attendance.sections[0]?.series[0] && k.key === attendance.executive[0]?.key && <Sparkline values={attendance.sections[0].series[0].points.map((p) => p.value)} tone={k.tone} />}
                </p>
                {k.delta && <p className={cn("mt-1 text-[12px] font-medium", TONE_TEXT[k.tone])}>{k.delta}</p>}
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {attendance.sections[0]?.series.slice(0, 2).map((x) => (
              <SeriesBars key={x.title} series={x} />
            ))}
          </div>
        </section>
      )}

      {!report && <p className="rounded-[20px] border border-dashed border-border-strong bg-surface px-4 py-10 text-center text-sm text-foreground-subtle">Não foi possível montar os números deste mês agora.</p>}

      {quickLinks.length > 0 && (
        <section>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">Ir para</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {quickLinks.map((l, i) => (
              <Link
                key={`${l.href}-${l.label}`}
                href={l.href}
                className="rounded-[12px] px-3.5 py-2 text-[13.5px] font-medium text-foreground transition-transform hover:-translate-y-0.5"
                style={{ background: ["#fbeba0", "#c4e4ff", "#c8f0d6", "#ddd3ff", "#ffd5d5"][i % 5] }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="text-center text-[12.5px] text-foreground-subtle">
        Quer o texto completo e para imprimir? Abra os{" "}
        <Link href={`/relatorios?mes=${month}`} className="font-medium text-accent hover:underline">
          Relatórios
        </Link>
        .
      </p>
    </div>
  );
}
