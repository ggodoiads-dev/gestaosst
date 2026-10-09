import { requireUser } from "@/server/auth/current-user";
import { listPendingAbsenceFollowUps } from "@/server/services/schedule.service";
import { interviewStateByNote } from "@/server/services/absence-interview.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { formatDate } from "@/lib/dates";
import { PendingFollowUpList } from "./pending-followup-list";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default async function PendenciasAdvertenciaPage() {
  const user = await requireUser();
  const notes = await listPendingAbsenceFollowUps(user);
  const interviews = await interviewStateByNote(notes.map((n) => n.id));

  return (
    <>
      <PageHeader
        title="Pendências de Advertência"
        description="Faltas que ainda precisam de advertência e/ou entrevista de ABS. Atestado médico não gera advertência: aparece aqui só para a entrevista de ABS."
      />
      <PageBody>
        <PendingFollowUpList
          items={notes.map((note) => ({
            noteId: note.id,
            kind: note.status === "ATESTADO" ? "ATESTADO" : "FALTA",
            interview: interviews.get(note.id) ?? null,
            collaboratorId: note.collaboratorId,
            collaboratorName: note.collaborator.name,
            dateLabel: formatDate(note.date),
            weekday: WEEKDAYS[note.date.getUTCDay()],
            notes: note.notes,
            warningApplied: note.warningApplied,
            absenceInterviewDone: note.absenceInterviewDone,
          }))}
        />
      </PageBody>
    </>
  );
}
