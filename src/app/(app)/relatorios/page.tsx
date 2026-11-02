import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { requireUser, hasPermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { buildMonthlyReport, monthLabelOf, shiftMonth } from "@/server/services/report.service";
import { buildDetailedReport, REPORT_KINDS } from "@/server/services/report-detail.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { APP_TIMEZONE } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { MonthlyReport, ReportKind, ReportVersion } from "@/domain/reports/types";
import { ReportDocument } from "./report-document";
import { AnalysisPanel } from "./analysis-panel";
import { PrintButton } from "./print-button";

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<{ mes?: string; versao?: string; tipo?: string }> }) {
  const user = await requireUser();
  if (!hasPermission(user, PERMISSIONS.INDICATORS_VIEW_CONSOLIDATED)) redirect("/inicio");
  const { mes, versao, tipo } = await searchParams;

  const nowKey = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM");
  const month = mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) && mes <= nowKey ? mes : nowKey;
  const version: ReportVersion = versao === "cliente" ? "cliente" : "interno";
  const kind: ReportKind = REPORT_KINDS.find((k) => k.key === tipo)?.key ?? "consolidado";
  const href = (m: string, v: ReportVersion, k: ReportKind = kind) => `/relatorios?tipo=${k}&mes=${m}&versao=${v}`;

  let report: MonthlyReport | null = null;
  let failure: string | null = null;
  try {
    report = kind === "consolidado" ? await buildMonthlyReport(user, month, version) : await buildDetailedReport(user, kind, month, version);
  } catch (error) {
    failure = error instanceof Error && error.message.startsWith("Não há") ? error.message : "Você não tem acesso a este relatório, ou ele não pôde ser gerado agora.";
  }

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Relatórios"
          description="O consolidado reúne tudo; os demais aprofundam um módulo só (DTO, equipamentos, checklists...). Todos com pontos críticos, comparação com o mês anterior e análise crítica, prontos para imprimir ou salvar em PDF."
          actions={<PrintButton />}
        />
      </div>
      <PageBody className="print:p-0">
        <nav className="flex flex-wrap gap-1.5 print:hidden" aria-label="Tipo de relatório">
          {REPORT_KINDS.map((k) => (
            <Link
              key={k.key}
              href={href(month, version, k.key)}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", kind === k.key ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-foreground-muted hover:bg-surface-muted")}
            >
              {k.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <Link href={href(shiftMonth(month, -1), version)} aria-label="Mês anterior" className="inline-flex size-9 items-center justify-center rounded-md border border-border-strong bg-surface hover:bg-surface-muted">
              <ChevronLeft className="size-4" />
            </Link>
            <span className="min-w-44 text-center text-sm font-semibold text-foreground">{monthLabelOf(month)}</span>
            <Link
              href={href(shiftMonth(month, 1), version)}
              aria-label="Próximo mês"
              className={cn("inline-flex size-9 items-center justify-center rounded-md border border-border-strong bg-surface hover:bg-surface-muted", month >= nowKey && "pointer-events-none opacity-40")}
            >
              <ChevronRight className="size-4" />
            </Link>
            {month !== nowKey && (
              <Link href={href(nowKey, version)} className="text-xs font-medium text-accent hover:underline">
                Mês atual
              </Link>
            )}
          </div>
          <div className="flex overflow-hidden rounded-md border border-border-strong text-xs font-medium">
            {(["interno", "cliente"] as const).map((v) => (
              <Link key={v} href={href(month, v)} className={cn("px-3 py-1.5", version === v ? "bg-accent text-accent-foreground" : "bg-surface text-foreground-subtle hover:bg-surface-muted")}>
                {v === "interno" ? "Versão interna (gestão)" : "Versão cliente (Ambev)"}
              </Link>
            ))}
          </div>
        </div>

        {month === nowKey && (
          <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning print:hidden">
            Mês em andamento: os números são parciais e mudam a cada importação e lançamento. Para um fechamento, emita depois da virada do mês e de importar o Guardian, o TMA e o DTO.
          </p>
        )}

        {report ? (
          <>
            <ReportDocument report={report} />
            <AnalysisPanel key={`${kind}-${month}-${version}`} month={month} version={version} kind={kind} />
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-border-strong bg-surface px-4 py-10 text-center text-sm text-foreground-subtle">{failure}</div>
        )}
      </PageBody>
    </>
  );
}
