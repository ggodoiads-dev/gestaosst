import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { requireUser, hasPermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { buildMonthlyReport, monthLabelOf, shiftMonth } from "@/server/services/report.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { APP_TIMEZONE } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { ReportVersion } from "@/domain/reports/types";
import { ReportDocument } from "./report-document";
import { AnalysisPanel } from "./analysis-panel";
import { PrintButton } from "./print-button";

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<{ mes?: string; versao?: string }> }) {
  const user = await requireUser();
  if (!hasPermission(user, PERMISSIONS.INDICATORS_VIEW_CONSOLIDATED)) redirect("/inicio");
  const { mes, versao } = await searchParams;

  const nowKey = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM");
  const month = mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) && mes <= nowKey ? mes : nowKey;
  const version: ReportVersion = versao === "cliente" ? "cliente" : "interno";
  const href = (m: string, v: ReportVersion) => `/relatorios?mes=${m}&versao=${v}`;

  const report = await buildMonthlyReport(user, month, version);

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Relatórios"
          description="Relatório mensal consolidado de segurança, conformidade e operação, com pontos críticos, comparação com o mês anterior e análise crítica. Pronto para imprimir ou salvar em PDF."
          actions={<PrintButton />}
        />
      </div>
      <PageBody className="print:p-0">
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

        <ReportDocument report={report} />
        <AnalysisPanel key={`${month}-${version}`} month={month} version={version} />
      </PageBody>
    </>
  );
}
