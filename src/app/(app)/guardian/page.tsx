import Link from "next/link";
import { ShieldCheck, Upload } from "lucide-react";
import { requireUser, requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { listGuardianReportsForUser, getGuardianAdherence, GUARDIAN_TYPE_LABELS } from "@/server/services/guardian.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";

export default async function GuardianPage() {
  const user = await requireUser();
  requirePermission(user, PERMISSIONS.GUARDIAN_MANAGE);

  const [reports, adherence] = await Promise.all([listGuardianReportsForUser(user), getGuardianAdherence(user)]);

  return (
    <>
      <PageHeader
        title="Guardian"
        description="Relatos de segurança importados do Guardian — comportamento de risco, condição insegura, incidente e reconhecimento."
        actions={
          <Button asChild size="sm">
            <Link href="/guardian/importar">
              <Upload className="size-4" /> Importar planilha
            </Link>
          </Button>
        }
      />
      <PageBody>
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2"><ShieldCheck className="size-4" /> Adesão ao Guardian</span>
            </CardTitle>
            <CardDescription>Dos colaboradores ativos, quantos já relataram pelo menos uma vez (qualquer tipo) — indicador de participação, não de quantidade.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
              <div>
                <p className="text-xs text-foreground-subtle">Já relataram</p>
                <p className="text-2xl font-semibold text-success tabular-nums">{adherence.reportedCount}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">Nunca relataram</p>
                <p className={`text-2xl font-semibold tabular-nums ${adherence.neverReportedCount > 0 ? "text-warning" : "text-success"}`}>
                  {adherence.neverReportedCount}
                </p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">Adesão</p>
                <p className="text-2xl font-semibold text-foreground tabular-nums">{adherence.adherencePercent}%</p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">Colaboradores ativos</p>
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
                <p className="text-xs font-medium text-foreground-subtle">Quem mais relata</p>
                {adherence.topReporters.map((r) => (
                  <div key={r.collaboratorId} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                    <Link href={`/colaboradores/${r.collaboratorId}`} className="text-accent hover:underline">{r.name}</Link>
                    <span className="tabular-nums text-foreground-subtle">{r.count} relato(s)</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Relatos ({reports.length})</CardTitle>
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
                        <Link href={`/colaboradores/${r.reporterCollaborator.id}`} className="text-accent hover:underline">
                          {r.reporterCollaborator.name}
                        </Link>
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
