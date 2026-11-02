import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Upload } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { requireUser, hasPermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { getTurnoverView } from "@/server/services/termination.service";
import { TERMINATION_KIND_LABEL } from "@/domain/termination/rules";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { StatCard } from "@/components/domain/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableCell, TableEmpty, TableRow } from "@/components/ui/table";
import { APP_TIMEZONE, formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { SeriesBars } from "../relatorios/report-charts";
import { DeleteTerminationButton } from "./delete-termination-button";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function Breakdown({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableBody>
            {rows.length === 0 && <TableEmpty colSpan={2} />}
            {rows.slice(0, 8).map((r) => (
              <TableRow key={r.label}>
                <TableCell>{r.label}</TableCell>
                <TableCell className="text-right tabular-nums">{r.count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default async function DesligamentosPage({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const user = await requireUser();
  if (!hasPermission(user, PERMISSIONS.HR_MANAGE)) redirect("/inicio");
  const { ano } = await searchParams;
  const nowYear = Number(formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy"));
  const year = ano && /^\d{4}$/.test(ano) && Number(ano) <= nowYear ? Number(ano) : nowYear;
  const v = await getTurnoverView(user, year);
  const t = v.totals;
  const href = (y: number) => `/desligamentos?ano=${y}`;

  return (
    <>
      <PageHeader
        title="Desligamentos e turnover"
        description="Base do turnover da operação. O efetivo de cada mês vem do cadastro de colaboradores (admissão e inativação); os desligamentos vêm da planilha do RH importada aqui. Reimportar o mesmo arquivo não duplica."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" asChild>
              <Link href={`/desligamentos/pdca?ano=${year}`}>PDCA do turnover</Link>
            </Button>
            <Button asChild>
            <Link href="/desligamentos/importar">
              <Upload className="size-4" /> Importar relatório de desligamentos
            </Link>
            </Button>
          </div>
        }
      />
      <PageBody>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="secondary" asChild>
            <Link href={href(year - 1)} aria-label="Ano anterior">
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
          <span className="min-w-20 text-center text-sm font-semibold text-foreground">{year}</span>
          <Button size="icon" variant="secondary" asChild disabled={year >= nowYear}>
            <Link href={href(year + 1)} aria-label="Próximo ano" className={cn(year >= nowYear && "pointer-events-none opacity-40")}>
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        </div>

        {!v.ready ? (
          <div className="rounded-lg border border-dashed border-border-strong bg-surface px-4 py-10 text-center text-sm text-foreground-subtle">
            A tabela de desligamentos ainda não existe no banco. Depois de criada, é só importar o relatório.
          </div>
        ) : t.exits === 0 ? (
          <div className="rounded-lg border border-dashed border-border-strong bg-surface px-4 py-10 text-center text-sm text-foreground-subtle">
            Nenhum desligamento em {year}. Importe o relatório do RH para começar.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <StatCard label={`Desligamentos em ${year}`} value={t.exits} hint={t.outside > 0 ? `+ ${t.outside} fora do turnover (QLP / transferência)` : undefined} />
              <StatCard label="Turnover do ano" value={t.yearRate === null ? "—" : `${t.yearRate}%`} hint="desligamentos ÷ efetivo médio" />
              <StatCard label="Pedido de demissão" value={t.voluntary} hint={t.exits ? `${Math.round((t.voluntary / t.exits) * 100)}% do total` : undefined} />
              <StatCard label="Iniciativa da empresa" value={t.company} hint={t.exits ? `${Math.round((t.company / t.exits) * 100)}% do total` : undefined} />
              <StatCard label="Saíram em até 90 dias" value={t.early90} tone={t.early90 > 0 ? "warning" : "neutral"} hint={t.withTenure ? `de ${t.withTenure} com data de admissão` : "sem data de admissão"} />
            </div>
            {t.unclassified > 0 && (
              <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
                {t.unclassified} desligamento(s) sem classificação (o motivo da planilha não indica pedido de demissão nem iniciativa da empresa). Isso distorce a leitura de voluntário e involuntário.
              </p>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Turnover mês a mês</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <SeriesBars series={{ title: "Desligamentos por mês", highlightLast: true, points: v.months.map((m) => ({ label: MONTHS[Number(m.month.slice(5, 7)) - 1], value: m.exits })) }} />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês</TableHead>
                      <TableHead className="text-right">Efetivo no início</TableHead>
                      <TableHead className="text-right">Efetivo no fim</TableHead>
                      <TableHead className="text-right">Desligamentos</TableHead>
                      <TableHead className="text-right">Turnover</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {v.months.map((m) => (
                      <TableRow key={m.month}>
                        <TableCell>{MONTHS[Number(m.month.slice(5, 7)) - 1]}</TableCell>
                        <TableCell className="text-right tabular-nums text-foreground-subtle">{m.headcountStart}</TableCell>
                        <TableCell className="text-right tabular-nums text-foreground-subtle">{m.headcountEnd}</TableCell>
                        <TableCell className="text-right tabular-nums">{m.exits}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{m.rate === null ? "—" : `${m.rate}%`}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="text-xs text-foreground-subtle">Efetivo estimado pelo cadastro: quem tinha admissão até a data e ainda não estava inativado. Colaborador sem data de admissão conta como já presente.</p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Breakdown title="Tipo de desligamento" rows={v.byKind} />
              <Breakdown title="Tempo de casa" rows={v.byTenure} />
              <Breakdown title="Principais motivos" rows={v.byReason} />
              <Breakdown title="Por área" rows={v.byArea} />
              <Breakdown title="Por turno" rows={v.byTurno} />
              <Breakdown title="Por cargo" rows={v.byCargo} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Desligamentos de {year}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Área / turno</TableHead>
                      <TableHead>Admissão</TableHead>
                      <TableHead>Desligamento</TableHead>
                      <TableHead>Tempo de casa</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {v.list.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-foreground-subtle">{r.cargo ?? "—"}</TableCell>
                        <TableCell className="text-foreground-subtle">{[r.areaName, r.turnoName].filter(Boolean).join(" · ") || "—"}</TableCell>
                        <TableCell className="text-foreground-subtle">{r.admissionDate ? formatDate(r.admissionDate) : "—"}</TableCell>
                        <TableCell>{formatDate(r.terminationDate)}</TableCell>
                        <TableCell className="text-foreground-subtle">{r.tenureDays === null ? "—" : `${r.tenureDays} dias`}</TableCell>
                        <TableCell>
                          <Badge tone={r.kind === "VOLUNTARIO" ? "info" : r.kind === "INVOLUNTARIO" ? "warning" : "neutral"} title={r.kind === "FORA_TURNOVER" ? "Não entra na conta do turnover." : undefined}>{TERMINATION_KIND_LABEL[r.kind].split(" (")[0]}</Badge>
                        </TableCell>
                        <TableCell className="max-w-56 truncate text-foreground-subtle" title={r.reason ?? undefined}>
                          {r.reason ?? "—"}
                        </TableCell>
                        <TableCell>
                          <DeleteTerminationButton id={r.id} name={r.name} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </PageBody>
    </>
  );
}
