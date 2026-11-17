import { requireUser, hasPermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { listPendingAbsenceFollowUps } from "@/server/services/schedule.service";
import { interviewStateByNote } from "@/server/services/absence-interview.service";
import { getDisciplineOverview } from "@/server/services/discipline.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { formatDate } from "@/lib/dates";
import { PendingFollowUpList } from "./pending-followup-list";
import { DisciplineSection } from "./discipline-section";
import { DisciplineRecordsSection } from "./discipline-records";
import { listCollaboratorsForDiscipline, listDisciplineRecords } from "@/server/services/discipline-record.service";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default async function PendenciasAdvertenciaPage() {
  const user = await requireUser();
  const canHr = hasPermission(user, PERMISSIONS.HR_MANAGE);
  const notes = await listPendingAbsenceFollowUps(user);
  const interviews = canHr ? await interviewStateByNote(notes.map((n) => n.id)) : new Map();
  const overview = await getDisciplineOverview(user);
  const [records, disciplineCollaborators] = await Promise.all([listDisciplineRecords(user), listCollaboratorsForDiscipline(user)]);
  const faltaByNote = new Map(overview.items.filter((i) => i.reason === "FALTA" && i.noteId).map((i) => [i.noteId!, i]));

  return (
    <>
      <PageHeader
        title="Pendências de Advertência"
        description="Registre uma advertência manualmente (motivo, descrição, data e aplicação, com anexo opcional) e acompanhe as medidas disciplinares por motivo (checklist não realizado e falta injustificada, cada um com a sua escada) e, para o RH, a entrevista de ABS. Atestado médico não gera advertência."
      />
      <PageBody>
        <div className="flex flex-col gap-8">
          <DisciplineRecordsSection
            ready={records.ready}
            collaborators={disciplineCollaborators}
            records={records.items.map((r) => ({ id: r.id, collaboratorId: r.collaboratorId, collaboratorName: r.collaboratorName, dayKey: r.dayKey, reason: r.reason, description: r.description, step: r.step, createdByName: r.createdByName, files: r.files.map((f) => ({ id: f.id, filename: f.filename, path: f.path, uploadedByName: f.uploadedByName })) }))}
          />
          <DisciplineSection items={overview.items.filter((i) => i.reason === "CHECKLIST")} />
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
