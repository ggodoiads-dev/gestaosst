import { GraduationCap, Clock, ClipboardCheck, ShieldCheck } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { getMyCollaboratorProfile } from "@/server/services/productivity.service";
import { listMyQualifications } from "@/server/services/qualification.service";
import { getCollaboratorTimeClockAdherence } from "@/server/services/time-clock.service";
import { getChecklistComplianceRange } from "@/server/services/checklist-compliance.service";
import { listMyGuardianReports } from "@/server/services/guardian.service";
import { GuardianReportRow } from "./guardian-report-row";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, parseDateOnly } from "@/lib/dates";
import { qualificationStatus } from "@/lib/qualification-status";

export default async function MeuPerfilPage() {
  const user = await requireUser();
  const collaborator = await getMyCollaboratorProfile(user);

  if (!collaborator) {
    return (
      <>
        <PageHeader title="Meu Perfil" description="Seus dados, qualificações e indicadores pessoais." />
        <PageBody>
          <Card>
            <CardContent className="py-10 text-center text-sm text-foreground-subtle">
              Seu usuário ainda não está vinculado a um colaborador. Peça pro seu gestor vincular seu acesso.
            </CardContent>
          </Card>
        </PageBody>
      </>
    );
  }

  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);

  const [qualifications, timeClockAdherence, checklistCompliance, guardianReports] = await Promise.all([
    listMyQualifications(user),
    getCollaboratorTimeClockAdherence(user, { collaboratorId: collaborator.id, from, to }),
    getChecklistComplianceRange(user, { collaboratorId: collaborator.id, from, to }).catch(() => null),
    listMyGuardianReports(user),
  ]);

  return (
    <>
      <PageHeader title="Meu Perfil" description="Seus dados, qualificações e indicadores dos últimos 30 dias." />
      <PageBody className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-1 flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Dados</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 text-sm">
              <div>
                <p className="text-xs text-foreground-subtle">Nome</p>
                <p>{collaborator.name}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">Matrícula</p>
                <p>{collaborator.matricula ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">Cargo</p>
                <p>{collaborator.cargo ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">Turno</p>
                <p>{collaborator.turno ? `Turno ${collaborator.turno.name} (${collaborator.turno.scheduleType.name})` : "—"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2"><GraduationCap className="size-4" /> Qualificações</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {qualifications.length === 0 && (
                <p className="text-sm text-foreground-subtle">Nenhuma qualificação registrada ainda.</p>
              )}
              {qualifications.map((record) => {
                const status = qualificationStatus(record.expiresAt);
                return (
                  <Badge key={record.id} tone={status.tone}>
                    {record.qualificationType.name} — {status.label}
                  </Badge>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2">
                  <Clock className="size-4" /> Ponto — aderência (30 dias)
                  {timeClockAdherence.adherencePercent !== null && (
                    <Badge tone={timeClockAdherence.adherencePercent >= 90 ? "success" : timeClockAdherence.adherencePercent >= 70 ? "warning" : "danger"}>
                      {timeClockAdherence.adherencePercent}%
                    </Badge>
                  )}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {!timeClockAdherence.usesTimeClock ? (
                <p className="text-sm text-foreground-subtle">Seu turno não bate ponto — sem acompanhamento aqui.</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-foreground-subtle">Faltas</p>
                      <p className={`text-lg font-semibold ${timeClockAdherence.daysWithFalta > 0 ? "text-danger" : "text-success"}`}>
                        {timeClockAdherence.daysWithFalta}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-foreground-subtle">Atrasos</p>
                      <p className={`text-lg font-semibold ${timeClockAdherence.daysWithAtraso > 0 ? "text-danger" : "text-success"}`}>
                        {timeClockAdherence.daysWithAtraso}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-foreground-subtle">Batidas ímpares</p>
                      <p className={`text-lg font-semibold ${timeClockAdherence.daysWithBatidaImpar > 0 ? "text-danger" : "text-success"}`}>
                        {timeClockAdherence.daysWithBatidaImpar}
                      </p>
                    </div>
                  </div>
                  {timeClockAdherence.anomalies.length === 0 ? (
                    <p className="text-sm text-foreground-subtle">Nenhuma ocorrência de ponto nos últimos 30 dias.</p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {timeClockAdherence.anomalies.map((a, index) => (
                        <div key={`${a.date}-${a.type}-${index}`} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                          <span className="text-foreground">{formatDate(parseDateOnly(a.date))}</span>
                          <div className="flex items-center gap-2">
                            <Badge tone={a.type === "FALTA" ? "danger" : "warning"}>
                              {a.type === "FALTA" ? "Falta" : a.type === "ATRASO" ? "Atraso" : "Batida ímpar"}
                            </Badge>
                            <span className="text-xs text-foreground-subtle">{a.detail}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {checklistCompliance && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <span className="flex items-center gap-2">
                    <ClipboardCheck className="size-4" /> Checklist — aderência (30 dias)
                    {checklistCompliance.summary.workDays > 0 && (() => {
                      const pct = Math.round((checklistCompliance.summary.completeDays / checklistCompliance.summary.workDays) * 100);
                      return <Badge tone={pct >= 90 ? "success" : pct >= 70 ? "warning" : "danger"}>{pct}%</Badge>;
                    })()}
                  </span>
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
                          <span className="text-xs text-foreground-subtle">faltou: {d.pending.map((e) => e.code).join(", ")}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2"><ShieldCheck className="size-4" /> Meus relatos Guardian ({guardianReports.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {guardianReports.length === 0 && (
                <p className="text-sm text-foreground-subtle">Nenhum relato seu importado ainda.</p>
              )}
              {guardianReports.map((r) => (
                <GuardianReportRow key={r.id} report={r} />
              ))}
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
