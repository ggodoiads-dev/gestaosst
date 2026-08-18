import { requireUser } from "@/server/auth/current-user";
import { listPendingAbsenceFollowUps } from "@/server/services/schedule.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import { PendingFollowUpRow } from "./pending-followup-row";

const STATUS_LABELS: Record<string, string> = { FALTA: "Falta", ATESTADO: "Atestado" };

export default async function PendenciasAdvertenciaPage() {
  const user = await requireUser();
  const notes = await listPendingAbsenceFollowUps(user);

  return (
    <>
      <PageHeader
        title="Pendências de Advertência"
        description="Faltas e atestados que ainda precisam de advertência aplicada e/ou entrevista de ABS."
      />
      <PageBody>
        <Card>
          <CardContent className="flex flex-col gap-3 pt-5">
            {notes.length === 0 && (
              <p className="text-sm text-foreground-subtle">Nenhuma pendência no momento.</p>
            )}
            {notes.map((note) => (
              <PendingFollowUpRow
                key={note.id}
                noteId={note.id}
                collaboratorId={note.collaboratorId}
                collaboratorName={note.collaborator.name}
                dateLabel={formatDate(note.date)}
                statusLabel={STATUS_LABELS[note.status ?? ""] ?? note.status ?? "—"}
                notes={note.notes}
                warningApplied={note.warningApplied}
                absenceInterviewDone={note.absenceInterviewDone}
              />
            ))}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
