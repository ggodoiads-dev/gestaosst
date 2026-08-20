import Link from "next/link";
import { headers } from "next/headers";
import { AlertTriangle, AlertOctagon, GraduationCap, HardHat, Printer, ClipboardList, ClipboardCheck, QrCode } from "lucide-react";
import { requireUser, hasPermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { getCollaboratorProntuario, getCollaboratorPhoto } from "@/server/services/collaborator.service";
import { attachmentUrl } from "@/lib/attachment-url";
import { listAreas } from "@/server/services/masterdata.service";
import { listTurnos } from "@/server/services/schedule.service";
import { getShiftCheckInStatusFor } from "@/server/services/shift-checkin.service";
import {
  listEpiDeliveriesForCollaborator,
  listEpiTypes,
  listJobFunctionsForCollaboratorForm,
} from "@/server/services/epi.service";
import { generateEpiDeliveryQrCode, generateCollaboratorQrCode } from "@/server/services/qrcode.service";
import { listActivityAptitudesForCollaborator } from "@/server/services/activity.service";
import { listEquipmentAptitudesForCollaborator } from "@/server/services/equipment.service";
import { listQualificationTypes } from "@/server/services/qualification.service";
import { listWarningsForCollaborator } from "@/server/services/warning.service";
import { getChecklistComplianceRange } from "@/server/services/checklist-compliance.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";
import { qualificationStatus } from "@/lib/qualification-status";
import { EditCollaboratorDialog } from "../collaborator-form-dialog";
import { DeleteCollaboratorButton } from "../collaborator-delete-button";
import { CollaboratorAccessPanel } from "../collaborator-access-panel";
import { ShiftCheckInPanel } from "../shift-checkin-panel";
import { EditSalaryDialog } from "../salary-dialog";
import { RequiresChecklistToggle } from "../requires-checklist-toggle";
import { RegisterEpiDeliveryDialog } from "./register-epi-delivery-dialog";
import { MarkEpiReturnedButton } from "./mark-epi-returned-button";
import { ActivityAptitudeDialog } from "./activity-aptitude-dialog";
import { EquipmentAptitudeDialog } from "./equipment-aptitude-dialog";
import { CreateQualificationRecordDialog, EditQualificationRecordDialog } from "@/app/(app)/qualificacoes/qualification-record-dialog";
import { CreateWarningDialog, DeleteWarningButton } from "./warning-dialog";

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
  const canManageQualifications = hasPermission(user, PERMISSIONS.QUALIFICATION_MANAGE);
  const canSeeChecklistCompliance = hasPermission(user, PERMISSIONS.CHECKLIST_COMPLIANCE_VIEW);
  const complianceTo = new Date();
  const complianceFrom = new Date();
  complianceFrom.setDate(complianceFrom.getDate() - 29);
  const [
    { collaborator, history, qualifications },
    areas,
    turnos,
    jobFunctions,
    epiDeliveries,
    epiTypes,
    shiftCheckIn,
    activityAptitudes,
    equipmentAptitudes,
    qualificationTypes,
    warnings,
    photo,
    checklistCompliance,
  ] = await Promise.all([
    getCollaboratorProntuario(user, id),
    listAreas(),
    listTurnos(user),
    listJobFunctionsForCollaboratorForm(user),
    listEpiDeliveriesForCollaborator(user, id),
    listEpiTypes(user, { onlyActive: true }),
    canManageCheckIn ? getShiftCheckInStatusFor(user, id) : Promise.resolve(null),
    canManage ? listActivityAptitudesForCollaborator(user, id) : Promise.resolve([]),
    canManage ? listEquipmentAptitudesForCollaborator(user, id) : Promise.resolve([]),
    canManageQualifications ? listQualificationTypes(user, { onlyActive: true }) : Promise.resolve([]),
    canSeeHr ? listWarningsForCollaborator(user, id) : Promise.resolve([]),
    getCollaboratorPhoto(id),
    canSeeChecklistCompliance
      ? getChecklistComplianceRange(user, { collaboratorId: id, from: complianceFrom, to: complianceTo })
      : Promise.resolve(null),
  ]);
  const photoUrl = photo ? attachmentUrl(photo.path) : null;

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
  const collaboratorQrDataUrl = collaborator.qrToken
    ? await generateCollaboratorQrCode(collaborator.qrToken, baseUrl)
    : null;
  const collaboratorQrUrl = collaborator.qrToken ? `${baseUrl}/q/${collaborator.qrToken}` : null;

  const currentQualifications: typeof qualifications = [];
  const seenTypeIds = new Set<string>();
  for (const record of qualifications) {
    if (seenTypeIds.has(record.qualificationTypeId)) continue;
    seenTypeIds.add(record.qualificationTypeId);
    currentQualifications.push(record);
  }

  return (
    <>
      <PageHeader
        title={collaborator.name}
        description={`${collaborator.cargo ?? "Cargo não informado"}${collaborator.area ? ` · ${collaborator.area.name}` : ""}`}
        actions={
          <div className="flex items-center gap-2">
            {collaborator.active ? <Badge tone="success">Ativo</Badge> : <Badge tone="neutral">Excluído</Badge>}
            {canManage && (
              <EditCollaboratorDialog
                collaborator={collaborator}
                areas={areas}
                turnos={turnos}
                jobFunctions={jobFunctions}
                photoUrl={photoUrl}
              />
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
              {photoUrl && (
                <a href={photoUrl} target="_blank" rel="noopener noreferrer" className="block w-fit">
                  {/* eslint-disable-next-line @next/next/no-img-element -- servido pela rota autenticada /api/uploads */}
                  <img
                    src={photoUrl}
                    alt={`Foto de ${collaborator.name}`}
                    className="size-20 rounded-full border border-border object-cover hover:opacity-90 transition-opacity"
                  />
                </a>
              )}
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

          {canSeeHr && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <span className="flex items-center gap-2"><AlertOctagon className="size-4" /> Advertências ({warnings.length})</span>
                </CardTitle>
                <CreateWarningDialog collaboratorId={collaborator.id} />
              </CardHeader>
              <CardContent className="flex flex-col gap-2.5">
                {warnings.length === 0 && (
                  <p className="text-sm text-foreground-subtle">Nenhuma advertência registrada.</p>
                )}
                {warnings.map((warning) => (
                  <div key={warning.id} className="flex items-start justify-between gap-2.5 rounded-md border border-border px-3 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{formatDate(warning.date)}</p>
                      <p className="text-xs text-foreground-subtle">{warning.reason}</p>
                    </div>
                    <DeleteWarningButton id={warning.id} collaboratorId={collaborator.id} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2"><GraduationCap className="size-4" /> Qualificações</span>
              </CardTitle>
              {canManageQualifications && (
                <CreateQualificationRecordDialog
                  collaborators={[collaborator]}
                  types={qualificationTypes}
                  defaultCollaboratorId={collaborator.id}
                />
              )}
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {currentQualifications.length === 0 && (
                <p className="text-sm text-foreground-subtle">Nenhuma qualificação registrada ainda.</p>
              )}
              {currentQualifications.map((record) => {
                const status = qualificationStatus(record.expiresAt);
                const badge = (
                  <Badge tone={status.tone}>
                    {record.qualificationType.name} — {status.label}
                  </Badge>
                );
                if (!canManageQualifications) return <span key={record.id}>{badge}</span>;
                return (
                  <EditQualificationRecordDialog
                    key={record.id}
                    record={{
                      id: record.id,
                      collaboratorId: record.collaboratorId,
                      qualificationTypeId: record.qualificationTypeId,
                      completedDate: record.completedDate,
                      notes: record.notes,
                    }}
                    collaborators={[collaborator]}
                    types={qualificationTypes}
                    trigger={badge}
                  />
                );
              })}
            </CardContent>
          </Card>

          {checklistCompliance && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <span className="flex items-center gap-2"><ClipboardCheck className="size-4" /> Checklist — aderência (30 dias)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-foreground-subtle">Turnos trabalhados</p>
                    <p className="text-lg font-semibold text-foreground">{checklistCompliance.summary.workDays}</p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground-subtle">Cumpriu tudo</p>
                    <p className="text-lg font-semibold text-success">{checklistCompliance.summary.completeDays}</p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground-subtle">Com pendência</p>
                    <p className={`text-lg font-semibold ${checklistCompliance.summary.incompleteDays > 0 ? "text-danger" : "text-success"}`}>
                      {checklistCompliance.summary.incompleteDays}
                    </p>
                  </div>
                </div>
                {(() => {
                  const missedDays = checklistCompliance.days.filter(
                    (d) => d.status === "TRABALHO" && d.required.length > 0 && d.pending.length > 0 && !d.future,
                  );
                  if (missedDays.length === 0) {
                    return <p className="text-sm text-foreground-subtle">Nenhum dia com checklist pendente nos últimos 30 dias.</p>;
                  }
                  return (
                    <div className="flex flex-col gap-1.5">
                      {missedDays.map((d) => (
                        <div key={d.date.toISOString()} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                          <span className="text-foreground">{formatDate(d.date)}</span>
                          <span className="text-xs text-foreground-subtle">
                            faltou: {d.pending.map((e) => e.code).join(", ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <span className="flex items-center gap-2"><ClipboardList className="size-4" /> Atividades</span>
                </CardTitle>
                <ActivityAptitudeDialog
                  collaboratorId={collaborator.id}
                  activities={activityAptitudes.map((a) => a.activity)}
                  aptActivityIds={activityAptitudes.filter((a) => a.apt).map((a) => a.activity.id)}
                />
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {activityAptitudes.filter((a) => a.apt).length === 0 && (
                  <p className="text-sm text-foreground-subtle">Nenhuma atividade marcada como apto ainda.</p>
                )}
                {activityAptitudes
                  .filter((a) => a.apt)
                  .map((a) => (
                    <Badge key={a.activity.id} tone="info">{a.activity.name}</Badge>
                  ))}
              </CardContent>
            </Card>
          )}

          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <span className="flex items-center gap-2"><HardHat className="size-4" /> Equipamentos</span>
                </CardTitle>
                <EquipmentAptitudeDialog
                  collaboratorId={collaborator.id}
                  equipments={equipmentAptitudes.map((a) => a.equipment)}
                  aptEquipmentIds={equipmentAptitudes.filter((a) => a.apt).map((a) => a.equipment.id)}
                />
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {equipmentAptitudes.filter((a) => a.apt).length === 0 && (
                  <p className="text-sm text-foreground-subtle">Nenhum equipamento marcado como apto ainda.</p>
                )}
                {equipmentAptitudes
                  .filter((a) => a.apt)
                  .map((a) => (
                    <Badge key={a.equipment.id} tone="info">{a.equipment.code} — {a.equipment.name}</Badge>
                  ))}
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

          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2"><QrCode className="size-4" /> QR Code</span>
              </CardTitle>
              <Button asChild variant="secondary" size="sm">
                <Link href={`/colaboradores/${collaborator.id}/qrcode/imprimir`} target="_blank">
                  <Printer className="size-3.5" /> Imprimir
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-2">
              {collaboratorQrDataUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={collaboratorQrDataUrl} alt={`QR Code de ${collaborator.name}`} className="size-40" />
                  <p className="text-xs text-foreground-subtle text-center break-all">{collaboratorQrUrl}</p>
                </>
              ) : (
                <p className="text-sm text-foreground-subtle">QR Code ainda não gerado.</p>
              )}
            </CardContent>
          </Card>
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
