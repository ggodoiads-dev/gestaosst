import Link from "next/link";
import { requireUser } from "@/server/auth/current-user";
import {
  getQualificationDashboard,
  listQualificationRecords,
  listQualificationTypes,
} from "@/server/services/qualification.service";
import { listCollaboratorsForUser } from "@/server/services/collaborator.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/dates";
import { qualificationStatus } from "@/lib/qualification-status";
import { CreateQualificationRecordDialog } from "./qualification-record-dialog";
import { QualificationFiltersBar } from "./qualification-filters-bar";
import type { QualificationCategory } from "@/generated/prisma/enums";

const CATEGORY_LABELS: Record<string, string> = {
  NR: "NR",
  ASO: "ASO",
  INTEGRACAO: "Integração",
  OUTRO: "Outro",
};

function daysUntil(date: Date) {
  const diff = date.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default async function QualificacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; tipo?: string; status?: string }>;
}) {
  const user = await requireUser();
  const { categoria, tipo, status } = await searchParams;
  const [dashboard, collaborators, types, allTypes, records] = await Promise.all([
    getQualificationDashboard(user),
    listCollaboratorsForUser(user, { onlyActive: true }),
    listQualificationTypes(user, { onlyActive: true }),
    listQualificationTypes(user),
    listQualificationRecords(user, {
      category: categoria as QualificationCategory | undefined,
      qualificationTypeId: tipo,
      status: status as "valido" | "vencendo" | "vencido" | undefined,
    }),
  ]);
  const categories = Array.from(new Set(allTypes.map((t) => t.category)));

  return (
    <>
      <PageHeader
        title="Qualificações"
        description="Treinamentos NR, ASO e integrações por colaborador, com vencimento calculado automaticamente."
        actions={<CreateQualificationRecordDialog collaborators={collaborators} types={types} />}
      />
      <PageBody className="flex flex-col gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-foreground-subtle">Colaboradores ativos</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{dashboard.activeCollaboratorsCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-foreground-subtle">Tipos cadastrados</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{dashboard.types.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-foreground-subtle">Vencendo em 30 dias</p>
              <p className="mt-1 text-2xl font-semibold text-warning">
                {dashboard.upcoming.filter((r) => daysUntil(r.expiresAt!) <= 30).length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-foreground-subtle">Vencidas</p>
              <p className="mt-1 text-2xl font-semibold text-danger">
                {dashboard.upcoming.filter((r) => daysUntil(r.expiresAt!) < 0).length}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <Card>
            <CardHeader>
              <CardTitle>Colaboradores válidos por tipo</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Ativos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.types.length === 0 && <TableEmpty colSpan={3} />}
                  {dashboard.types.map((type) => (
                    <TableRow key={type.id}>
                      <TableCell>{type.name}</TableCell>
                      <TableCell><Badge tone="info">{CATEGORY_LABELS[type.category] ?? type.category}</Badge></TableCell>
                      <TableCell className="font-medium">{type.activeCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Próximos vencimentos</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5">
              {dashboard.upcoming.length === 0 && (
                <p className="text-sm text-foreground-subtle">Nenhum vencimento programado.</p>
              )}
              {dashboard.upcoming.map((record) => {
                const remaining = daysUntil(record.expiresAt!);
                return (
                  <Link
                    key={`${record.collaboratorId}-${record.qualificationTypeId}`}
                    href={`/colaboradores/${record.collaboratorId}`}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-muted"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{record.collaborator.name}</p>
                      <p className="truncate text-xs text-foreground-subtle">{record.qualificationType.name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-foreground-subtle">{formatDate(record.expiresAt)}</p>
                      <Badge tone={remaining < 0 ? "danger" : remaining <= 30 ? "warning" : "success"}>
                        {remaining < 0 ? `${Math.abs(remaining)}d vencido` : `${remaining}d restantes`}
                      </Badge>
                    </div>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <CardTitle>Registros ({records.length})</CardTitle>
            <QualificationFiltersBar
              categories={categories}
              types={allTypes.map((t) => ({ id: t.id, name: t.name, category: t.category }))}
              current={{ category: categoria, qualificationTypeId: tipo, status }}
            />
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Concluído em</TableHead>
                  <TableHead>Vence em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0 && <TableEmpty colSpan={4} />}
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <Link href={`/colaboradores/${record.collaboratorId}`} className="text-accent hover:underline">
                        {record.collaborator.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-foreground-subtle">{record.qualificationType.name}</TableCell>
                    <TableCell className="text-foreground-subtle">{formatDate(record.completedDate)}</TableCell>
                    <TableCell>
                      {(() => {
                        const s = qualificationStatus(record.expiresAt);
                        return <Badge tone={s.tone}>{s.label}</Badge>;
                      })()}
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
