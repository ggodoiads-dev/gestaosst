import Link from "next/link";
import { requireUser } from "@/server/auth/current-user";
import { listAccidentsForUser } from "@/server/services/accident.service";
import { listAreas } from "@/server/services/masterdata.service";
import { listCollaboratorsForUser } from "@/server/services/collaborator.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AccidentStatusBadge, CriticalityBadge } from "@/components/domain/status-badges";
import { formatDate } from "@/lib/dates";
import { CreateAccidentDialog } from "./accident-form-dialog";

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
};

export default async function AcidentesPage() {
  const user = await requireUser();
  const [accidents, areas, collaborators] = await Promise.all([
    listAccidentsForUser(user),
    listAreas(),
    listCollaboratorsForUser(user, { onlyActive: true }),
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
        <Card>
          <CardHeader>
            <CardTitle>Ocorrências ({accidents.length})</CardTitle>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {accidents.length === 0 && <TableEmpty colSpan={8} />}
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
