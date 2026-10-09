import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { requireUser } from "@/server/auth/current-user";
import { getCollaboratorChecklistDayDetail } from "@/server/services/checklist-compliance.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { StatCard } from "@/components/domain/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { APP_TIMEZONE, formatDate, formatDateTime, parseDateOnly } from "@/lib/dates";
import { attachmentUrl } from "@/lib/attachment-url";
import { JustifyChecklistItemDialog } from "@/components/domain/justify-checklist-item-dialog";

const RESULT_TONE: Record<string, "success" | "info" | "warning" | "danger"> = {
  LIBERADO: "success",
  LIBERADO_COM_OBSERVACAO: "info",
  RESTRITO: "warning",
  BLOQUEADO: "danger",
};

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function dayKeyOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default async function ChecklistDoColaboradorPage({
  params,
  searchParams,
}: {
  params: Promise<{ collaboratorId: string }>;
  searchParams: Promise<{ dia?: string }>;
}) {
  const { collaboratorId } = await params;
  const { dia } = await searchParams;
  const user = await requireUser();
  const todayKey = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
  const dayKey = dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : todayKey;
  const day = parseDateOnly(dayKey);

  let detail: Awaited<ReturnType<typeof getCollaboratorChecklistDayDetail>>;
  try {
    detail = await getCollaboratorChecklistDayDetail(user, { collaboratorId, dayKey });
  } catch {
    notFound();
  }

  const prev = dayKeyOf(addDays(day, -1));
  const next = dayKeyOf(addDays(day, 1));
  const isToday = dayKey === todayKey;
  const complete = detail.required > 0 && detail.missing.length === 0;

  return (
    <>
      <PageHeader
        title={detail.collaborator.name}
        description={`Checklists do dia — ${detail.collaborator.area ? `Área ${detail.collaborator.area}` : "sem área definida"}`}
        actions={
          <div className="flex items-center gap-2">
            <Button size="icon" variant="secondary" asChild>
              <Link href={`?dia=${prev}`} aria-label="Dia anterior"><ChevronLeft className="size-4" /></Link>
            </Button>
            <span className="min-w-36 text-center text-sm font-medium text-foreground">
              {WEEKDAY_LABELS[day.getDay()]}, {formatDate(day)}{isToday && " (hoje)"}
            </span>
            <Button size="icon" variant="secondary" asChild>
              <Link href={`?dia=${next}`} aria-label="Próximo dia"><ChevronRight className="size-4" /></Link>
            </Button>
          </div>
        }
      />
      <PageBody>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard label="Exigidos" value={detail.required} />
          <StatCard label="Feitos" value={detail.doneCount} tone="success" />
          <StatCard label="Faltam" value={detail.missing.length} tone={detail.missing.length > 0 ? "danger" : "success"} />
        </div>

        {!detail.collaborator.hasLogin && (
          <p className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-foreground-subtle">
            Esta pessoa ainda não tem acesso ao sistema, então não há como ter feito checklist.
          </p>
        )}

        {detail.missing.length > 0 && (
          <Card>
            <CardContent className="flex flex-col gap-2 py-4">
              <p className="text-sm font-semibold text-danger">
                Faltou{isToday ? " (até agora)" : ""} — {detail.missing.length}
              </p>
              <div className="flex flex-col divide-y divide-border">
                {detail.missing.map((e) => (
                  <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="font-medium text-foreground">{e.code}</span>
                      {e.name !== e.code && <span className="text-foreground-subtle"> — {e.name}</span>}
                      {e.note && (
                        <span className="block text-xs text-foreground-subtle">
                          Justificativa registrada ({e.note.reasonLabel}): {e.note.note} — não conclui o item.
                        </span>
                      )}
                    </span>
                    {detail.canJustify && (
                      <JustifyChecklistItemDialog
                        collaboratorId={detail.collaborator.id}
                        collaboratorName={detail.collaborator.name}
                        dayKey={dayKey}
                        itemId={e.id}
                        itemLabel={e.code}
                        currentReason={e.note?.reason ?? null}
                        currentNote={e.note?.note ?? null}
                      />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        {complete && <p className="text-sm font-medium text-success">Tudo que era exigido foi feito (ou justificado) neste dia.</p>}

        {detail.justified.length > 0 && (
          <Card>
            <CardContent className="flex flex-col gap-2 py-4">
              <p className="text-sm font-semibold text-foreground">Justificados e concluídos — {detail.justified.length}</p>
              <div className="flex flex-col divide-y divide-border">
                {detail.justified.map((e) => (
                  <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="font-medium text-foreground">{e.code}</span>
                      <span className="block text-xs text-foreground-subtle">
                        {e.justification.reasonLabel}: {e.justification.note} — por {e.justification.createdByName},{" "}
                        {formatDateTime(e.justification.createdAt)}
                      </span>
                    </span>
                    {detail.canJustify && (
                      <JustifyChecklistItemDialog
                        collaboratorId={detail.collaborator.id}
                        collaboratorName={detail.collaborator.name}
                        dayKey={dayKey}
                        itemId={e.id}
                        itemLabel={e.code}
                        currentReason={e.justification.reason}
                        currentNote={e.justification.note}
                      />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-foreground">Checklists respondidos ({detail.executions.length})</p>
          {detail.executions.length === 0 && (
            <p className="text-sm text-foreground-subtle">Nenhum checklist finalizado neste dia.</p>
          )}
          {detail.executions.map((ex) => (
            <details key={ex.id} className="group rounded-lg border border-border bg-surface">
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="font-medium text-foreground">{ex.equipmentCode}</span>
                  <span className="text-foreground-subtle"> — {ex.equipmentName}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-foreground-subtle">{formatDateTime(ex.finishedAt)}</span>
                  {ex.result && <Badge tone={RESULT_TONE[ex.result] ?? "neutral"}>{ex.result.replaceAll("_", " ")}</Badge>}
                </span>
              </summary>
              <div className="flex flex-col gap-3 border-t border-border px-4 py-3">
                {ex.answers.length === 0 && <p className="text-xs text-foreground-subtle">Sem respostas registradas.</p>}
                {ex.answers.map((a, i) => (
                  <div key={i} className="flex flex-col gap-1 text-sm">
                    <p className="text-foreground-subtle">{a.question}</p>
                    <p className="font-medium text-foreground">
                      {a.value ?? "—"} {a.critical && <Badge tone="danger">Crítica</Badge>}
                    </p>
                    {a.comment && <p className="text-xs text-foreground-subtle">Observação: {a.comment}</p>}
                    {a.photos.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {a.photos.map((p) => (
                          <a key={p.id} href={attachmentUrl(p.path)} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={attachmentUrl(p.path)} alt={p.filename} className="h-20 w-20 rounded-md border border-border object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      </PageBody>
    </>
  );
}
