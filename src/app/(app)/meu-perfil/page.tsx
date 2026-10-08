import Link from "next/link";
import { ChevronLeft, ChevronRight, ClipboardCheck, Clock, GraduationCap, MapPin, ShieldCheck, CalendarClock, Hash } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { getMyCollaboratorProfile } from "@/server/services/productivity.service";
import { listMyQualifications } from "@/server/services/qualification.service";
import { getCollaboratorTimeClockAdherence } from "@/server/services/time-clock.service";
import { getChecklistComplianceRange } from "@/server/services/checklist-compliance.service";
import { getCollaboratorPhoto } from "@/server/services/collaborator.service";
import { listMyGuardianReports } from "@/server/services/guardian.service";
import { GuardianReportRow } from "./guardian-report-row";
import { ProfilePhotoUploader } from "./profile-photo-uploader";
import { ProgressRing, toneForPercent } from "./progress-ring";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, parseDateOnly } from "@/lib/dates";
import { attachmentUrl } from "@/lib/attachment-url";
import { qualificationStatus } from "@/lib/qualification-status";
import { currentMonthKey, isValidMonthKey, monthLabel, monthRangeUntilToday, monthShortLabel, shiftMonth } from "@/lib/month";
import type { CurrentUser } from "@/server/auth/current-user";

const HISTORY_MONTHS = 6;

async function loadMonth(user: CurrentUser, collaboratorId: string, month: string) {
  const { from, to } = monthRangeUntilToday(month);
  const [timeClock, checklist] = await Promise.all([
    getCollaboratorTimeClockAdherence(user, { collaboratorId, from, to }),
    getChecklistComplianceRange(user, { collaboratorId, from, to }).catch(() => null),
  ]);
  const checklistPercent =
    checklist && checklist.summary.workDays > 0
      ? Math.round((checklist.summary.completeDays / checklist.summary.workDays) * 100)
      : null;
  return { timeClock, checklist, checklistPercent };
}

function MiniBar({ label, percent }: { label: string; percent: number | null }) {
  const tone = toneForPercent(percent);
  const color = tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : tone === "danger" ? "bg-danger" : "bg-border-strong";
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-12 shrink-0 text-foreground-subtle">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-soft">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${percent ?? 0}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right tabular-nums text-foreground">{percent === null ? "—" : `${percent}%`}</span>
    </div>
  );
}

export default async function MeuPerfilPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
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

  const { mes } = await searchParams;
  const nowMonth = currentMonthKey();
  const month = isValidMonthKey(mes) && mes <= nowMonth ? mes : nowMonth;
  const isCurrentMonth = month === nowMonth;

  const historyKeys = Array.from({ length: HISTORY_MONTHS }, (_, i) => shiftMonth(nowMonth, -i));

  const [qualifications, guardianReports, photo, selected, ...history] = await Promise.all([
    listMyQualifications(user),
    listMyGuardianReports(user),
    getCollaboratorPhoto(collaborator.id),
    loadMonth(user, collaborator.id, month),
    ...historyKeys.map((k) => (k === month ? Promise.resolve(null) : loadMonth(user, collaborator.id, k))),
  ]);
  const historyData = historyKeys.map((k, i) => ({ month: k, data: k === month ? selected : history[i] }));

  const { timeClock, checklist, checklistPercent } = selected;
  const missedChecklistDays = checklist
    ? checklist.days.filter((d) => d.status === "TRABALHO" && d.required.length > 0 && d.pending.length > 0 && !d.future)
    : [];

  return (
    <>
      <PageHeader title="Meu Perfil" description="Seus dados, qualificações e indicadores — o mês recomeça do zero, e os anteriores ficam guardados." />
      <PageBody>
        {/* Cartão de apresentação */}
        <div className="overflow-hidden rounded-xl bg-brand text-white shadow-md">
          <div className="relative flex flex-col items-center gap-5 px-6 py-7 sm:flex-row sm:items-center">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.07]"
              style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "20px 20px" }}
            />
            <div className="relative">
              <ProfilePhotoUploader name={collaborator.name} photoUrl={photo ? attachmentUrl(photo.path) : null} />
            </div>
            <div className="relative flex min-w-0 flex-col items-center gap-2 text-center sm:items-start sm:text-left">
              <h2 className="text-xl font-semibold leading-tight sm:text-2xl">{collaborator.name}</h2>
              <p className="text-sm text-white/75">{collaborator.cargo ?? "Cargo não informado"}</p>
              <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-xs sm:justify-start">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
                  <Hash className="size-3" /> {collaborator.matricula ?? "sem matrícula"}
                </span>
                {collaborator.area && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
                    <MapPin className="size-3" /> {collaborator.area.name}
                  </span>
                )}
                {collaborator.turno && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
                    <CalendarClock className="size-3" /> Turno {collaborator.turno.name} · {collaborator.turno.scheduleType.name}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-white/55">Toque na foto para trocar por outra da sua galeria ou tirar uma agora.</p>
            </div>
          </div>
        </div>

        {/* Navegação de mês */}
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="secondary" size="sm">
            <Link href={`/meu-perfil?mes=${shiftMonth(month, -1)}`}>
              <ChevronLeft className="size-4" /> Anterior
            </Link>
          </Button>
          <div className="text-center">
            <p className="text-base font-semibold text-foreground">{monthLabel(month)}</p>
            {isCurrentMonth ? (
              <p className="text-[11px] text-foreground-subtle">mês em andamento — começou do zero no dia 1</p>
            ) : (
              <Link href="/meu-perfil" className="text-xs text-accent hover:underline">Voltar para o mês atual</Link>
            )}
          </div>
          {isCurrentMonth ? (
            <Button variant="secondary" size="sm" disabled>
              Próximo <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button asChild variant="secondary" size="sm">
              <Link href={shiftMonth(month, 1) === nowMonth ? "/meu-perfil" : `/meu-perfil?mes=${shiftMonth(month, 1)}`}>
                Próximo <ChevronRight className="size-4" />
              </Link>
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 items-start">
          {/* Ponto */}
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2"><Clock className="size-4" /> Ponto</span>
              </CardTitle>
              <CardDescription>Dias sem falta, atraso ou batida ímpar, sobre os dias trabalhados — contado até ontem (D-1), porque o dia de hoje ainda está em andamento.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {!timeClock.usesTimeClock ? (
                <p className="text-sm text-foreground-subtle">Seu turno não bate ponto — sem acompanhamento aqui.</p>
              ) : (
                <>
                  <div className="flex items-center gap-5">
                    <ProgressRing percent={timeClock.adherencePercent} label="Aderência de ponto" />
                    <div className="grid flex-1 grid-cols-3 gap-2 text-center text-sm">
                      <div className="rounded-lg bg-surface-muted px-2 py-2.5">
                        <p className={`text-xl font-semibold tabular-nums ${timeClock.daysWithFalta > 0 ? "text-danger" : "text-success"}`}>{timeClock.daysWithFalta}</p>
                        <p className="text-[11px] text-foreground-subtle">Faltas</p>
                      </div>
                      <div className="rounded-lg bg-surface-muted px-2 py-2.5">
                        <p className={`text-xl font-semibold tabular-nums ${timeClock.daysWithAtraso > 0 ? "text-danger" : "text-success"}`}>{timeClock.daysWithAtraso}</p>
                        <p className="text-[11px] text-foreground-subtle">Atrasos</p>
                      </div>
                      <div className="rounded-lg bg-surface-muted px-2 py-2.5">
                        <p className={`text-xl font-semibold tabular-nums ${timeClock.daysWithBatidaImpar > 0 ? "text-danger" : "text-success"}`}>{timeClock.daysWithBatidaImpar}</p>
                        <p className="text-[11px] text-foreground-subtle">Batidas ímpares</p>
                      </div>
                    </div>
                  </div>
                  {timeClock.anomalies.length === 0 ? (
                    <p className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">Nenhuma ocorrência de ponto neste mês. 👏</p>
                  ) : (
                    <details className="rounded-md border border-border px-3 py-2 text-sm">
                      <summary className="cursor-pointer text-xs font-medium text-foreground-subtle">
                        Ver as {timeClock.anomalies.length} ocorrência(s) do mês
                      </summary>
                      <div className="mt-2 flex flex-col gap-1.5">
                        {timeClock.anomalies.map((a, index) => (
                          <div key={`${a.date}-${a.type}-${index}`} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
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
                    </details>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Checklist */}
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2"><ClipboardCheck className="size-4" /> Checklist</span>
              </CardTitle>
              <CardDescription>Turnos em que você fez todos os checklists que eram da sua função — contado até ontem (D-1).</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {!checklist ? (
                <p className="text-sm text-foreground-subtle">Sem acompanhamento de checklist para o seu cadastro.</p>
              ) : (
                <>
                  <div className="flex items-center gap-5">
                    <ProgressRing percent={checklistPercent} label="Aderência de checklist" />
                    <div className="grid flex-1 grid-cols-3 gap-2 text-center text-sm">
                      <div className="rounded-lg bg-surface-muted px-2 py-2.5">
                        <p className="text-xl font-semibold tabular-nums text-foreground">{checklist.summary.workDays}</p>
                        <p className="text-[11px] text-foreground-subtle">Turnos</p>
                      </div>
                      <div className="rounded-lg bg-surface-muted px-2 py-2.5">
                        <p className="text-xl font-semibold tabular-nums text-success">{checklist.summary.completeDays}</p>
                        <p className="text-[11px] text-foreground-subtle">Cumpriu tudo</p>
                      </div>
                      <div className="rounded-lg bg-surface-muted px-2 py-2.5">
                        <p className={`text-xl font-semibold tabular-nums ${checklist.summary.incompleteDays > 0 ? "text-danger" : "text-success"}`}>{checklist.summary.incompleteDays}</p>
                        <p className="text-[11px] text-foreground-subtle">Pendentes</p>
                      </div>
                    </div>
                  </div>
                  {missedChecklistDays.length === 0 ? (
                    <p className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">Nenhum checklist pendente neste mês. 👏</p>
                  ) : (
                    <details className="rounded-md border border-border px-3 py-2 text-sm">
                      <summary className="cursor-pointer text-xs font-medium text-foreground-subtle">
                        Ver os {missedChecklistDays.length} dia(s) com pendência
                      </summary>
                      <div className="mt-2 flex flex-col gap-1.5">
                        {missedChecklistDays.map((d) => (
                          <div key={d.date.toISOString()} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                            <span className="text-foreground">{formatDate(d.date)}</span>
                            <span className="text-xs text-foreground-subtle">faltou: {d.pending.map((e) => e.code).join(", ")}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Meses guardados */}
        <Card>
          <CardHeader>
            <CardTitle>Meus meses</CardTitle>
            <CardDescription>Aderência de cada mês, guardada. Toque num mês para ver o detalhe.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {historyData.map(({ month: k, data }) => {
              const active = k === month;
              return (
                <Link
                  key={k}
                  href={k === nowMonth ? "/meu-perfil" : `/meu-perfil?mes=${k}`}
                  className={`flex flex-col gap-2 rounded-lg border p-3 transition-colors hover:bg-surface-muted ${active ? "border-accent bg-accent-soft/40" : "border-border"}`}
                >
                  <span className="text-xs font-semibold capitalize text-foreground">{monthShortLabel(k)}</span>
                  <MiniBar label="Ponto" percent={data && data.timeClock.usesTimeClock ? data.timeClock.adherencePercent : null} />
                  <MiniBar label="Check." percent={data ? data.checklistPercent : null} />
                </Link>
              );
            })}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 items-start">
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2"><GraduationCap className="size-4" /> Minhas qualificações</span>
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
