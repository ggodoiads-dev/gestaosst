import { requireUser, requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { listInterviewsForHr } from "@/server/services/absence-interview.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { formatDate } from "@/lib/dates";
import { InterviewList } from "./interview-list";

export default async function EntrevistasAbsPage() {
  const user = await requireUser();
  requirePermission(user, PERMISSIONS.HR_MANAGE);
  let interviews: Awaited<ReturnType<typeof listInterviewsForHr>> = [];
  try {
    interviews = await listInterviewsForHr(user);
  } catch (error) {
    console.error("[entrevistas-abs] falha ao listar:", error);
  }

  return (
    <>
      <PageHeader
        title="Entrevistas de ABS"
        description="Entrevistas de absenteísmo pedidas aos colaboradores. Peça pela fila de Pendências de Advertência."
      />
      <PageBody>
        <InterviewList
          items={interviews.map((i) => ({
            id: i.id,
            name: i.collaborator.name,
            area: i.collaborator.area?.name ?? null,
            kind: i.note.status === "ATESTADO" ? "Atestado" : "Falta",
            dateLabel: formatDate(i.note.date),
            status: i.status,
            classification: i.classification,
          }))}
        />
      </PageBody>
    </>
  );
}
