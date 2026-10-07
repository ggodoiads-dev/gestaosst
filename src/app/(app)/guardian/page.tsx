import Link from "next/link";
import { ChevronLeft, ChevronRight, ShieldCheck, Upload } from "lucide-react";
import { requireUser, hasPermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import {
  currentMonthKey,
  getGuardianAdherence,
  GUARDIAN_TYPE_LABELS,
  isValidMonthKey,
  listGuardianReportsOfMonth,
} from "@/server/services/guardian.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function GuardianPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const user = await requireUser();
  const canImport = hasPermission(user, PERMISSIONS.GUARDIAN_MANAGE);
  if (!canImport && !hasPermission(user, PERMISSIONS.GUARDIAN_VIEW)) throw new ForbiddenError();
  // A ficha do colaborador exige acesso de gestão/RH — pra quem só visualiza (Auditor) o nome vira texto.
  const canOpenProfiles = canImport || hasPermission(user, PERMISSIONS.COLLABORATOR_MANAGE) || hasPermission(user, PERMISSIONS.HR_MANAGE);

  const { mes } = await searchParams;
  const nowMonth = currentMonthKey();
  const month = isValidMonthKey(mes) && mes <= nowMonth ? mes : nowMonth;

  const [reports, { selected: adherence, history }] = await Promise.all([
    listGuardianReportsOfMonth(user, month),
    getGuardianAdherence(user, month),
  ]);

  const isCurrentMonth = month === nowMonth;

  return (
    <>
      <PageHeader
        title="Guardian"
        description="Relatos de segurança importados do Guardian — comportamento de risco, condição insegura, incidente e reconhecimento."
        actions={
          canImport ? (
            <Button asChild size="sm">
              <Link href="/guardian/importar">
                <Upload className="size-4" /> Importar planilha
              </Link>
            </Button>
          ) : undefined
        }
      />
      <PageBody>
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="secondary" size="sm">
            <Link href={`/guardian?mes=${shiftMonth(month, -1)}`}>
              <ChevronLeft className="size-4" /> Mês anterior
            </Link>
          </Button>
          <div className="text-center">
            <p className="text-base font-semibold text-foreground">{monthLabel(month)}</p>
            {!isCurrentMonth && (
              <Link href="/guardian" className="text-xs text-accent hover:underline">
                Voltar para o mês atual
              </Link>
            )}
          </div>
          {isCurrentMonth ? (
            <Button variant="secondary" size="sm" disabled>
              Próximo mês <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/guardian?mes=${shiftMonth(month, 1)}`}>
                Próximo mês <ChevronRight className="size-4" />
              </Link>
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2"><ShieldCheck className="size-4" /> Adesão ao Guardian — {monthLabel(month)}</span>
            </CardTitle>
            <CardDescription>
              Dos colaboradores que estavam ativos no mês, quantos relataram pelo menos uma vez (qualquer tipo). O mês
              atual se atualiza a cada importação; os meses fechados ficam guardados.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
              <div>
                <p className="text-xs text-foreground-subtle">Relataram no mês</p>
                <p className="text-2xl font-semibold text-success tabular-nums">{adherence.reportedCount}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">Não relataram</p>
                <p className={`text-2xl font-semibold tabular-nums ${adherence.notReportedCount > 0 ? "text-warning" : "text-success"}`}>
                  {adherence.notReportedCount}
                </p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">Adesão</p>
                <p className="text-2xl font-semibold text-foreground tabular-nums">{adherence.adherencePercent}%</p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">Colaboradores no mês</p>
                <p className="text-2xl font-semibold text-foreground tabular-nums">{adherence.activeCollaboratorsCount}</p>
              </div>
            </div>

            {adherence.byType.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {adherence.byType.map((t) => (
                  <Badge key={t.type} tone="info">{GUARDIAN_TYPE_LABELS[t.type]}: {t.count}</Badge>
                ))}
              </div>
            )}

            {adherence.topReporters.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-medium text-foreground-subtle">Quem mais relatou no mês</p>
                {adherence.topReporters.map((r) => (
                  <div key={r.collaboratorId} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                    {canOpenProfiles ? <Link href={`/colaboradores/${r.collaboratorId}`} className="text-accent hover:underline">{r.name}</Link> : <span>{r.name}</span>}
                    <span className="tabular-nums text-foreground-subtle">{r.count} relato(s)</span>
                  </div>
                ))}
              </div>
            )}

            {adherence.notReported.length > 0 && (
              <details className="rounded-md border border-border px-3 py-2 text-sm">
                <summary className="cursor-pointer text-xs font-medium text-foreground-subtle">
                  Quem ainda não relatou neste mês ({adherence.notReported.length})
                </summary>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {adherence.notReported.map((c) => (
                    canOpenProfiles ? (
                      <Link key={c.collaboratorId} href={`/colaboradores/${c.collaboratorId}`} className="text-accent hover:underline">
                        {c.name}
                      </Link>
                    ) : (
                      <span key={c.collaboratorId}>{c.name}</span>
                    )
                  ))}
                </div>
              </details>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico mensal</CardTitle>
            <CardDescription>Adesão de cada mês, calculada com quem estava ativo naquele mês. Clique para abrir o mês.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead>Colaboradores</TableHead>
                  <TableHead>Relataram</TableHead>
                  <TableHead>Adesão</TableHead>
                  <TableHead>Relatos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.month}>
                    <TableCell>
                      <Link href={h.month === nowMonth ? "/guardian" : `/guardian?mes=${h.month}`} className={h.month === month ? "font-semibold text-foreground" : "text-accent hover:underline"}>
                        {monthLabel(h.month)}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums text-foreground-subtle">{h.activeCollaboratorsCount}</TableCell>
                    <TableCell className="tabular-nums text-foreground-subtle">{h.reportedCount}</TableCell>
                    <TableCell>
                      <Badge tone={h.adherencePercent >= 70 ? "success" : h.adherencePercent >= 40 ? "warning" : "danger"}>
                        {h.adherencePercent}%
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums text-foreground-subtle">{h.reportsCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Relatos de {monthLabel(month)} ({reports.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Categoria</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.length === 0 && <TableEmpty colSpan={5} />}
                {reports.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell><Badge tone="info">{GUARDIAN_TYPE_LABELS[r.type]}</Badge></TableCell>
                    <TableCell>
                      {r.reporterCollaborator ? (
                        canOpenProfiles ? (
                          <Link href={`/colaboradores/${r.reporterCollaborator.id}`} className="text-accent hover:underline">
                            {r.reporterCollaborator.name}
                          </Link>
                        ) : (
                          r.reporterCollaborator.name
                        )
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-foreground-subtle">{r.occurredAt ? formatDate(r.occurredAt) : "—"}</TableCell>
                    <TableCell className="text-foreground-subtle">{r.area ?? "—"}</TableCell>
                    <TableCell className="text-foreground-subtle truncate max-w-xs">{r.categoryName ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
