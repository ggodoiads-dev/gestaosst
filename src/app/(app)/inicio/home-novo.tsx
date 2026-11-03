import { Greeting } from "@/components/domain/greeting";
import { greetingNow } from "@/lib/greeting";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { buildHeadline, type MarkTone } from "@/domain/home/headline";
import { ALERT_SEVERITY_LABEL, type SystemAlert } from "@/domain/alerts/rules";
import { cn } from "@/lib/utils";

const MARK: Record<MarkTone, string> = { mint: "#c8f0d6", sky: "#c4e4ff", lemon: "#fbeba0", rose: "#ffd5d5" };
const DOT: Record<SystemAlert["severity"], string> = { CRITICO: "#d6342c", ALTO: "#e0a21b", ATENCAO: "#0068d8" };

export type HomeNovoProps = {
  firstName: string;
  dateLabel: string;
  alerts: SystemAlert[];
  checklistPct: number | null;
  turnover: { rate: number | null; goal: number | null } | null;
  ncAbertas: number | null;
  equipamentosBloqueados: number | null;
  meuChecklist: { previstos: number; realizados: number; atrasados: number };
  quickLinks: { href: string; label: string }[];
  /** Cartão escuro de contraste: o número que mais importa para quem abriu. */
  featured: { id: "turnover" | "checklist"; label: string; value: string; unit?: string; note: string; href: string } | null;
};

function Stat({ label, value, unit, note, tone }: { label: string; value: string; unit?: string; note?: string; tone?: "ok" | "bad" | "warn" }) {
  return (
    <section className="rounded-[20px] border border-border bg-surface p-5">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">{label}</p>
      <p className="mt-3 text-[54px] font-semibold leading-none tracking-[-0.05em] text-foreground">
        {value}
        {unit && <span className="ml-0.5 text-[24px] font-medium tracking-tight text-foreground-muted">{unit}</span>}
      </p>
      {note && (
        <p className={cn("mt-3 text-[13px]", tone === "bad" ? "text-danger" : tone === "warn" ? "text-warning" : tone === "ok" ? "text-success" : "text-foreground-muted")}>{note}</p>
      )}
    </section>
  );
}

export function HomeNovo(p: HomeNovoProps) {
  const critical = p.alerts.filter((a) => a.severity === "CRITICO").length;
  const headline = buildHeadline({ alertCount: p.alerts.length, criticalCount: critical, checklistPct: p.checklistPct, turnover: p.turnover });
  const checkTone = p.checklistPct === null ? undefined : p.checklistPct >= 90 ? "ok" : p.checklistPct >= 80 ? "warn" : "bad";
  const turnoverWithin = p.turnover && p.turnover.rate !== null && p.turnover.goal !== null ? p.turnover.rate <= p.turnover.goal : null;

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-7 px-4 py-7 sm:px-8 sm:py-9">
      <div>
        <p className="text-[13px] font-medium text-foreground-subtle">
          {p.dateLabel} · <Greeting initial={greetingNow()} lowercase />, {p.firstName}
        </p>
        <h1 className="mt-2 max-w-[880px] text-[34px] font-medium leading-[1.1] tracking-[-0.035em] text-foreground sm:text-[46px]">
          {headline.map((part, i) => (
            <span
              key={i}
              className={cn(part.serif && "sigo-serif text-[1.08em]", part.mark && "sigo-mark")}
              style={part.mark ? ({ ["--mark" as string]: MARK[part.mark] } as React.CSSProperties) : undefined}
            >
              {part.text}
            </span>
          ))}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.05fr_1fr]">
        {p.featured ? (
          <Link
            href={p.featured.href}
            className="group relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-[24px] bg-brand p-6 text-white"
          >
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#9db4dc]">
                <span className="size-[7px] rounded-full bg-brand-accent shadow-[0_0_0_4px_rgba(0,216,240,0.15)]" />
                {p.featured.label}
              </p>
              <ArrowUpRight className="size-5 text-[#9db4dc] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </div>
            <div>
              <p className="text-[84px] font-semibold leading-none tracking-[-0.055em]">
                {p.featured.value}
                {p.featured.unit && <span className="ml-1 text-[32px] font-medium tracking-tight text-[#9db4dc]">{p.featured.unit}</span>}
              </p>
              <p className="mt-3 max-w-[40ch] text-[14px] text-[#b9c8e6]">{p.featured.note}</p>
            </div>
          </Link>
        ) : (
          <section className="rounded-[24px] bg-brand p-6 text-white">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#9db4dc]">Seu checklist hoje</p>
            <p className="mt-4 text-[84px] font-semibold leading-none tracking-[-0.055em]">
              {p.meuChecklist.realizados}
              <span className="ml-1 text-[32px] font-medium text-[#9db4dc]">/ {p.meuChecklist.previstos}</span>
            </p>
            <p className="mt-3 text-[14px] text-[#b9c8e6]">{p.meuChecklist.atrasados > 0 ? `${p.meuChecklist.atrasados} atrasado(s)` : "Nada atrasado."}</p>
          </section>
        )}

        <div className="grid grid-cols-2 gap-4">
          {p.checklistPct !== null && p.featured?.id !== "checklist" && <Stat label="Aderência de checklist" value={String(p.checklistPct)} unit="%" note="Último dia fechado" tone={checkTone} />}
          {p.turnover && p.turnover.rate !== null && p.featured?.id !== "turnover" && (
            <Stat
              label="Turnover 12 meses"
              value={String(p.turnover.rate).replace(".", ",")}
              unit="%"
              note={p.turnover.goal !== null ? `Meta do ano ${String(p.turnover.goal).replace(".", ",")}%` : undefined}
              tone={turnoverWithin === null ? undefined : turnoverWithin ? "ok" : "bad"}
            />
          )}
          {p.ncAbertas !== null && <Stat label="NCs abertas" value={String(p.ncAbertas).padStart(2, "0")} note={p.ncAbertas > 0 ? "Acompanhar planos de ação" : "Nenhuma aberta"} tone={p.ncAbertas > 0 ? "warn" : "ok"} />}
          {p.equipamentosBloqueados !== null && (
            <Stat label="Equipamentos bloqueados" value={String(p.equipamentosBloqueados).padStart(2, "0")} note={p.equipamentosBloqueados > 0 ? "Fora de operação" : "Todos liberados"} tone={p.equipamentosBloqueados > 0 ? "bad" : "ok"} />
          )}
        </div>
      </div>

      <section className="rounded-[24px] border border-border bg-surface p-6">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">Precisa de você hoje</p>
        {p.alerts.length === 0 ? (
          <p className="mt-4 text-[15px] text-foreground-muted">Nenhuma regra de aviso foi disparada agora.</p>
        ) : (
          <ol className="mt-2 flex flex-col">
            {p.alerts.slice(0, 6).map((a, i) => (
              <li key={a.key} className="grid grid-cols-[34px_1fr_auto] items-baseline gap-3 border-b border-border py-4 last:border-b-0">
                <span className="sigo-mono text-[12px] text-foreground-subtle">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <p className="flex items-center gap-2 text-[16px] font-semibold tracking-[-0.01em] text-foreground">
                    <span className="inline-block size-2 rounded-full" style={{ background: DOT[a.severity] }} aria-hidden />
                    {a.title}
                  </p>
                  <p className="mt-0.5 text-[13.5px] text-foreground-muted">
                    <span className="font-medium">{ALERT_SEVERITY_LABEL[a.severity]}.</span> {a.detail}
                  </p>
                </div>
                <Link href={a.href} className="text-[13px] font-semibold text-accent hover:underline">
                  Abrir →
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      {p.quickLinks.length > 0 && (
        <section>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">Ir para</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {p.quickLinks.map((l, i) => (
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
    </div>
  );
}
