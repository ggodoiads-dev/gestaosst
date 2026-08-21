import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { getAccidentDetail } from "@/server/services/accident.service";
import { listCollaboratorsForUser } from "@/server/services/collaborator.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AccidentStatusBadge, AccidentActionStatusBadge, CriticalityBadge } from "@/components/domain/status-badges";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@/lib/dates";
import { AccidentStatusActions } from "../accident-status-actions";
import { CreateAccidentActionDialog, CompleteAccidentActionButton } from "../accident-action-dialog";
import { AccidentAttachments } from "../accident-attachments";

const TYPE_LABELS: Record<string, string> = {
  ACIDENTE_TIPICO: "Acidente típico",
  ACIDENTE_TRAJETO: "Acidente de trajeto",
  QUASE_ACIDENTE: "Quase acidente",
  DOENCA_OCUPACIONAL: "Doença ocupacional",
  FAI: "FAI",
};

const SIF_LABELS: Record<string, string> = {
  SIF_PRECURSOR: "SIF Precursor",
  SIF_POTENCIAL: "SIF Potencial",
  SIF_REAL: "SIF Real",
  FAI: "FAI",
};

export default async function AcidenteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const [accident, collaborators] = await Promise.all([
    getAccidentDetail(user, id),
    listCollaboratorsForUser(user, { onlyActive: true }),
  ]);

  return (
    <>
      <PageHeader
        title={accident.code}
        description={`${TYPE_LABELS[accident.type] ?? accident.type} · ${formatDate(accident.date)}${accident.area ? ` · ${accident.area.name}` : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/acidentes">
                <ArrowLeft className="size-4" /> Voltar
              </Link>
            </Button>
            <CriticalityBadge value={accident.severity} />
            <AccidentStatusBadge status={accident.status} />
            <AccidentStatusActions id={accident.id} status={accident.status} code={accident.code} />
          </div>
        }
      />
      <PageBody className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Descrição</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <p className="text-foreground-muted whitespace-pre-wrap">{accident.description}</p>
              {accident.immediateCause && (
                <div>
                  <p className="text-xs text-foreground-subtle">Causa imediata</p>
                  <p>{accident.immediateCause}</p>
                </div>
              )}
              {accident.rootCause && (
                <div>
                  <p className="text-xs text-foreground-subtle">Causa raiz</p>
                  <p>{accident.rootCause}</p>
                </div>
              )}
              {accident.isSif && (
                <div>
                  <p className="text-xs text-foreground-subtle">Classificação SIF</p>
                  <Badge tone="danger">{SIF_LABELS[accident.sifClassification ?? ""] ?? "SIF"}</Badge>
                </div>
              )}
              {accident.creditNumber && (
                <div>
                  <p className="text-xs text-foreground-subtle">Número do Credit</p>
                  <p>{accident.creditNumber}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-foreground-subtle">Reportado por</p>
                <p>{accident.reportedBy.name} em {formatDateTime(accident.reportedAt)}</p>
              </div>
              {accident.investigatedBy && (
                <div>
                  <p className="text-xs text-foreground-subtle">Investigado por</p>
                  <p>{accident.investigatedBy.name}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ações corretivas ({accident.actions.length})</CardTitle>
              <CreateAccidentActionDialog accidentId={accident.id} collaborators={collaborators} />
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5">
              {accident.actions.length === 0 && (
                <p className="text-sm text-foreground-subtle">Nenhuma ação registrada.</p>
              )}
              {accident.actions.map((action) => (
                <div key={action.id} className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p>{action.description}</p>
                    <p className="text-xs text-foreground-subtle">
                      {(action.responsibleCollaborator?.name ?? action.responsibleUser?.name) ?? "Sem responsável"} · até {formatDate(action.dueDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <AccidentActionStatusBadge status={action.status} />
                    {action.status !== "CONCLUIDA" && action.status !== "CANCELADA" && (
                      <CompleteAccidentActionButton actionId={action.id} accidentId={accident.id} />
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Evidências ({accident.attachments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <AccidentAttachments accidentId={accident.id} attachments={accident.attachments} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Envolvidos ({accident.involvements.length})</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {accident.involvements.length === 0 && (
                <p className="text-sm text-foreground-subtle">Nenhum colaborador vinculado.</p>
              )}
              {accident.involvements.map((involvement) => (
                <div key={involvement.collaboratorId} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <span>{involvement.collaborator.name}</span>
                  <Badge tone={involvement.role === "VITIMA" ? "danger" : "neutral"}>
                    {involvement.role === "VITIMA" ? "Envolvido" : "Testemunha"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
