import Link from "next/link";
import { headers } from "next/headers";
import { AlertTriangle, GraduationCap, HardHat, Printer } from "lucide-react";
import { requireUser, hasPermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { getCollaboratorProntuario } from "@/server/services/collaborator.service";
import { listAreas } from "@/server/services/masterdata.service";
import { listTurnos } from "@/server/services/schedule.service";
import { getShiftCheckInStatusFor } from "@/server/services/shift-checkin.service";
import {
  listEpiDeliveriesForCollaborator,
  listEpiTypes,
  listJobFunctionsForCollaboratorForm,
} from "@/server/services/epi.service";
import { generateEpiDeliveryQrCode } from "@/server/services/qrcode.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";
import { EditCollaboratorDialog } from "../collaborator-form-dialog";
import { DeleteCollaboratorButton } from "../collaborator-delete-button";
import { CollaboratorAccessPanel } from "../collaborator-access-panel";
import { ShiftCheckInPanel } from "../shift-checkin-panel";
import { EditSalaryDialog } from "../salary-dialog";
import { RequiresChecklistToggle } from "../requires-checklist-toggle";
import { RegisterEpiDeliveryDialog } from "./register-epi-delivery-dialog";
import { MarkEpiReturnedButton } from "./mark-epi-returned-button";

const EPI_REASON_LABELS: Record<string, string> = {
  PRIMEIRA_ENTREGA: "1 — Primeira entrega",
  SUBSTITUICAO_DANO_JUSTIFICADO: "2 — Substituição (dano justificado)",
  SUBSTITUICAO_DANO_PROPRIO_PERDA: "3 — Substituição (dano próprio/perda)",
  TROCA_DANIFICADO_VENCIDO: "4 — Troca (danificado/vencido)",
  DEVOLUCAO_DEMISSAO_MUDANCA_FUNCAO: "5 — Devolução/demissão/mudança de função",
};

export default async function ColaboradorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const canManage = hasPermission(user, PERMISSIONS.COLLABORATOR_MANAGE);
  const canSeeHr = hasPermission(user, PERMISSIONS.HR_MANAGE);
  const canManageCheckIn = hasPermission(user, PERMISSIONS.SHIFT_CHECKIN_MANAGE);
  const [{ collaborator, history }, areas, turnos, jobFunctions, epiDeliveries, epiTypes, shiftCheckIn] =
    await Promise.all([
      getCollaboratorProntuario(user, id),
      listAreas(),
      listTurnos(user),
      listJobFunctionsForCollaboratorForm(user),
      listEpiDeliveriesForCollaborator(user, id),
      listEpiTypes(user, { onlyActive: true }),
      canManageCheckIn ? getShiftCheckInStatusFor(user, id) : Promise.resolve(null),
    ]);

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${protocol}://${host}`;
  const epiQrCodes = new Map(
    await Promise.all(
      epiDeliveries
        .filter((d) => d.traceable && d.qrToken)
        .map(async (d) => [d.id, await generateEpiDeliveryQrCode(d.qrToken!, baseUrl)] as const),
    ),
  );

  return (
    <>
      <PageHeader
        title={collaborator.name}
        description={`${collaborator.cargo ?? "Cargo não informado"}${collaborator.area ? ` · ${collaborator.area.name}` : ""}`}
        actions={
          <div className="flex items-center gap-2">
            {collaborator.active ? <Badge tone="success">Ativo</Badge> : <Badge tone="neutral">Excluído</Badge>}
            {canManage && (
              <EditCollaboratorDialog collaborator={collaborator} areas={areas} turnos={turnos} jobFunctions={jobFunctions} />
            )}
            {canManage && collaborator.active && (
              <DeleteCollaboratorButton id={collaborator.id} name={collaborator.name} />
            )}
          </div>
        }
      />
      <PageBody className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-1 flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Dados</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 text-sm">
              <div>
                <p className="text-xs text-foreground-subtle">Matrícula</p>
                <p>{collaborator.matricula ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">Cargo / Função</p>
                <p>{collaborator.cargo ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">CPF</p>
                <p>{collaborator.cpf ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">CTPS</p>
                <p>
                  {collaborator.ctps ?? "—"}
                  {collaborator.ctpsSerie ? ` / série ${collaborator.ctpsSerie}` : ""}
                </p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">Área</p>
                <p>{collaborator.area?.name ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">Turno</p>
                <p>{collaborator.turno ? `Turno ${collaborator.turno.name} (${collaborator.turno.scheduleType.name})` : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">Data de admissão</p>
                <p>{formatDate(collaborator.admissionDate)}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">Telefone</p>
                <p>{collaborator.phone ?? "—"}</p>
              </div>
            </CardContent>
          </Card>

          {canSeeHr && (
            <Card>
              <CardHeader>
                <CardTitle>Dados de RH</CardTitle>
                <EditSalaryDialog
                  collaboratorId={collaborator.id}
                  collaboratorName={collaborator.name}
                  currentSalary={collaborator.salary ? Number(collaborator.salary) : null}
                />
              </CardHeader>
              <CardContent className="flex flex-col gap-4 text-sm">
                <div>
                  <p className="text-xs text-foreground-subtle">Salário</p>
                  <p>
                    {collaborator.salary ? (
                      <span className="tabular-nums">{formatCurrency(Number(collaborator.salary))}</span>
                    ) : (
                      <Badge tone="neutral">Não definido</Badge>
                    )}
                  </p>
                </div>
                <label className="flex items-center gap-2.5">
                  <RequiresChecklistToggle
                    collaboratorId={collaborator.id}
                    defaultChecked={collaborator.requiresChecklist}
                  />
                  <span>Precisa de checklist (cobrado no relatório de ponto)</span>
                </label>
              </CardContent>
            </Card>
          )}

          <CollaboratorAccessPanel
            collaboratorId={collaborator.id}
            checklistEnabled={collaborator.checklistEnabled}
            userEmail={collaborator.user?.email ?? null}
          />

          {shiftCheckIn && (
            <ShiftCheckInPanel
              collaboratorId={collaborator.id}
              status={shiftCheckIn.status}
              checkedIn={shiftCheckIn.checkedIn}
              checkedInAt={shiftCheckIn.checkedInAt}
            />
          )}
        </div>

        <div className="lg:col-span-2 flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2"><HardHat className="size-4" /> Ficha de EPI ({epiDeliveries.length})</span>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/colaboradores/${collaborator.id}/ficha-epi/imprimir`} target="_blank">
                    <Printer className="size-3.5" /> Imprimir ficha
                  </Link>
                </Button>
                <RegisterEpiDeliveryDialog collaboratorId={collaborator.id} epiTypes={epiTypes} />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>EPI</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>CA</TableHead>
                    <TableHead>Tam.</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Entrega</TableHead>
                    <TableHead>Devolução</TableHead>
                    <TableHead>Rastreabilidade</TableHead>
                    <TableHead className="w-36" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {epiDeliveries.length === 0 && <TableEmpty colSpan={9} />}
                  {epiDeliveries.map((delivery) => {
                    const qrDataUrl = epiQrCodes.get(delivery.id);
                    return (
                      <TableRow key={delivery.id} id={`epi-${delivery.id}`}>
                        <TableCell>{delivery.epiType.name}</TableCell>
                        <TableCell>{delivery.quantity}</TableCell>
                        <TableCell className="text-foreground-subtle">{delivery.ca || "—"}</TableCell>
                        <TableCell className="text-foreground-subtle">{delivery.size || "—"}</TableCell>
                        <TableCell className="text-foreground-subtle text-xs">
                          {EPI_REASON_LABELS[delivery.reason] ?? delivery.reason}
                        </TableCell>
                        <TableCell className="text-foreground-subtle">{formatDate(delivery.deliveredAt)}</TableCell>
                        <TableCell className="text-foreground-subtle">
                          {delivery.returnedAt ? formatDate(delivery.returnedAt) : "—"}
                        </TableCell>
                        <TableCell>
                          {qrDataUrl ? (
                            <div className="flex flex-col items-center gap-1">
                              <img src={qrDataUrl} alt={`QR Code — ${delivery.epiType.name}`} className="size-16" />
                              <span className="font-mono text-[10px] text-foreground-subtle">{delivery.code}</span>
                            </div>
                          ) : (
                            <span className="text-foreground-subtle">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {!delivery.returnedAt && (
                            <MarkEpiReturnedButton id={delivery.id} collaboratorId={collaborator.id} />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Histórico ({history.length})</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5">
              {history.length === 0 && (
                <p className="text-sm text-foreground-subtle">Nenhum registro ainda.</p>
              )}
              {history.map((entry, index) => {
                if (entry.kind === "ACIDENTE") {
                  return (
                    <Link
                      key={`acidente-${index}`}
                      href={`/acidentes/${entry.involvement.accidentId}`}
                      className="flex items-start gap-2.5 rounded-md border border-border px-3 py-2.5 text-sm hover:bg-surface-muted"
                    >
                      <AlertTriangle className="size-4 shrink-0 mt-0.5 text-danger" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">
                          {entry.involvement.accident.code} —{" "}
                          {entry.involvement.role === "VITIMA" ? "Envolvido" : "Testemunha"}
                        </p>
                        <p className="text-xs text-foreground-subtle">{formatDate(entry.date)}</p>
                      </div>
                    </Link>
                  );
                }
                return (
                  <div
                    key={`qualificacao-${index}`}
                    className="flex items-start gap-2.5 rounded-md border border-border px-3 py-2.5 text-sm"
                  >
                    <GraduationCap className="size-4 shrink-0 mt-0.5 text-info" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{entry.record.qualificationType.name}</p>
                      <p className="text-xs text-foreground-subtle">
                        Concluído em {formatDate(entry.date)}
                        {entry.record.expiresAt ? ` · vence em ${formatDate(entry.record.expiresAt)}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
