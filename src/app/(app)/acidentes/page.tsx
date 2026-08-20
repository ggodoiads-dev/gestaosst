import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/server/auth/current-user";
import { listAccidentsForUser, getAccidentMonthlyStats } from "@/server/services/accident.service";
import { updateAccidentStatusAction } from "@/server/actions/accident.actions";
import { listAreas } from "@/server/services/masterdata.service";
import { listCollaboratorsForUser } from "@/server/services/collaborator.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AccidentStatusBadge, CriticalityBadge } from "@/components/domain/status-badges";
import { SoftDeleteButton, ReactivateButton } from "@/components/domain/soft-delete-button";
import { MonthlyBarChart } from "@/components/domain/charts/monthly-bar-chart";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { CreateAccidentDialog, EditAccidentDialog } from "./accident-form-dialog";
import { AccidentInsightCard, AccidentInsightSkeleton } from "./accident-insight-card";

const TYPE_LABELS: Record<string, string> = {
  ACIDENTE_TIPICO: "Acidente típico",
  ACIDENTE_TRAJETO: "Acidente de trajeto",
  QUASE_ACIDENTE: "Quase acidente",
  DOENCA_OCUPACIONAL: "Doença ocupacional",
};

const SIF_LABELS: Record<string, string> = {
  SIF_PRECURSOR: "SIF Precursor",
  SIF_POTENCIAL: "SIF Potencial",
  SIF_REAL: "SIF Real",
  FAI: "FAI",
};

const STATUS_FILTERS = [
  { key: "ativos", label: "Ativos", status: undefined },
  { key: "cancelados", label: "Cancelados", status: "CANCELADA" as const },
  { key: "todos", label: "Todos", status: "ALL" as const },
];

export default async function AcidentesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireUser();
  const { status: statusParam } = await searchParams;
  const activeFilter = STATUS_FILTERS.find((f) => f.key === statusParam) ?? STATUS_FILTERS[0]!;

  const [accidents, areas, collaborators, monthlyStats] = await Promise.all([
    listAccidentsForUser(user, { status: activeFilter.status }),
    listAreas(),
    listCollaboratorsForUser(user, { onlyActive: true }),
    getAccidentMonthlyStats(user),
  ]);

  return (
    <>
      <PageHeader
        title="Investigação de Acidentes"
        description="Registro e inventário de acidentes, incidentes e quase acidentes da operação."
        actions={
          <div className="flex items-center gap-2">
            <CreateAccidentDialog areas={areas} collaborators={collaborators} mode="acidente" />
            <CreateAccidentDialog areas={areas} collaborators={collaborators} mode="incidente" />
          </div>
        }
      />
      <PageBody>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Acidentes e incidentes por mês ({monthlyStats.year})</CardTitle>
              <CardDescription>{monthlyStats.totalCount} registro(s) no ano, sem contar cancelados.</CardDescription>
            </CardHeader>
            <CardContent>
              <MonthlyBarChart data={monthlyStats.monthly} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tipo mais recorrente</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {monthlyStats.byType.length === 0 && (
                <p className="text-sm text-foreground-subtle">Sem registros suficientes ainda.</p>
              )}
              {monthlyStats.byType.map((t) => (
                <div key={t.type} className="flex items-center justify-between text-sm">
                  <span className="text-foreground-subtle">{t.label}</span>
                  <span className="font-semibold tabular-nums">{t.count}</span>
                </div>
              ))}
              <Suspense fallback={<AccidentInsightSkeleton />}>
                <AccidentInsightCard user={user} stats={monthlyStats} />
              </Suspense>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Ocorrências ({accidents.length})</CardTitle>
              <div className="flex items-center gap-1">
                {STATUS_FILTERS.map((f) => (
                  <Link
                    key={f.key}
                    href={f.key === "ativos" ? "/acidentes" : `/acidentes?status=${f.key}`}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                      activeFilter.key === f.key
                        ? "bg-accent-soft text-accent"
                        : "text-foreground-subtle hover:text-foreground",
                    )}
                  >
                    {f.label}
                  </Link>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Severidade</TableHead>
                  <TableHead>SIF</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Envolvidos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {accidents.length === 0 && <TableEmpty colSpan={9} />}
                {accidents.map((accident) => (
                  <TableRow key={accident.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/acidentes/${accident.id}`} className="text-accent hover:underline">
                        {accident.code}
                      </Link>
                    </TableCell>
                    <TableCell className="text-foreground-subtle">{formatDate(accident.date)}</TableCell>
                    <TableCell>{TYPE_LABELS[accident.type] ?? accident.type}</TableCell>
                    <TableCell><CriticalityBadge value={accident.severity} /></TableCell>
                    <TableCell>
                      {accident.isSif ? (
                        <Badge tone="danger">{SIF_LABELS[accident.sifClassification ?? ""] ?? "SIF"}</Badge>
                      ) : (
                        <span className="text-foreground-subtle">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-foreground-subtle">{accident.area?.name ?? "—"}</TableCell>
                    <TableCell className="text-foreground-subtle">
                      {accident.involvements.map((i) => i.collaborator.name).join(", ") || "—"}
                    </TableCell>
                    <TableCell><AccidentStatusBadge status={accident.status} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <EditAccidentDialog accident={accident} areas={areas} collaborators={collaborators} />
                        {accident.status === "CANCELADA" ? (
                          <ReactivateButton
                            ariaLabel="Reativar acidente"
                            successMessage={`${accident.code} reativado.`}
                            onConfirm={updateAccidentStatusAction.bind(null, accident.id, "ABERTO")}
                          />
                        ) : (
                          <SoftDeleteButton
                            title={`Cancelar ${accident.code}?`}
                            description="O acidente fica marcado como cancelado e some da aba de ativos. Nada é apagado — dá pra reverter em Cancelados."
                            ariaLabel="Cancelar acidente"
                            successMessage={`${accident.code} cancelado.`}
                            onConfirm={updateAccidentStatusAction.bind(null, accident.id, "CANCELADA")}
                          />
                        )}
                      </div>
                    </TableCell>
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
