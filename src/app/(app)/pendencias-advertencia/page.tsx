import { requireUser, hasPermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { listPendingAbsenceFollowUps } from "@/server/services/schedule.service";
import { interviewStateByNote } from "@/server/services/absence-interview.service";
import { getDisciplineOverview } from "@/server/services/discipline.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { formatDate } from "@/lib/dates";
import { PendingFollowUpList } from "./pending-followup-list";
import { DisciplineSection } from "./discipline-section";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default async function PendenciasAdvertenciaPage() {
  const user = await requireUser();
  const canHr = hasPermission(user, PERMISSIONS.HR_MANAGE);
  const notes = await listPendingAbsenceFollowUps(user);
  const interviews = canHr ? await interviewStateByNote(notes.map((n) => n.id)) : new Map();
  const overview = await getDisciplineOverview(user);
  const faltaByNote = new Map(overview.items.filter((i) => i.reason === "FALTA" && i.noteId).map((i) => [i.noteId!, i]));

  return (
    <>
      <PageHeader
        title="Pendências de Advertência"
        description="Medidas disciplinares por motivo (checklist não realizado e falta injustificada, cada um com a sua escada) e, para o RH, a entrevista de ABS. Atestado médico não gera advertência."
      />
      <PageBody>
        <div className="flex flex-col gap-8">
          <DisciplineSection
            items={overview.items.filter((i) => i.reason === "CHECKLIST")}
            history={overview.history.map((h) => ({ ...h, decidedAtLabel: formatDate(h.decidedAt) }))}
          />
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground">Faltas e atestados</h2>
            <PendingFollowUpList
              canHr={canHr}
              items={notes
                .filter((note) => canHr || note.status === "FALTA")
                .map((note) => ({
                  noteId: note.id,
                  attachments: note.attachments,
                  kind: note.status === "ATESTADO" ? ("ATESTADO" as const) : ("FALTA" as const),
                  interview: interviews.get(note.id) ?? null,
                  collaboratorId: note.collaboratorId,
                  collaboratorName: note.collaborator.name,
                  dateLabel: formatDate(note.date),
                  weekday: WEEKDAYS[note.date.getUTCDay()],
                  notes: note.notes,
                  warningApplied: note.warningApplied,
                  absenceInterviewDone: note.absenceInterviewDone,
                  discipline: faltaByNote.get(note.id) ?? null,
                }))}
            />
          </section>
        </div>
      </PageBody>
    </>
  );
}
