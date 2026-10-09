import Link from "next/link";
import { requireUser } from "@/server/auth/current-user";
import { listMyInterviews } from "@/server/services/absence-interview.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/dates";

const STATUS = {
  SOLICITADA: { label: "Responder agora", tone: "warning" },
  RESPONDIDA: { label: "Enviada", tone: "info" },
  CONCLUIDA: { label: "Concluída", tone: "success" },
} as const;

export default async function MinhasEntrevistasPage() {
  const user = await requireUser();
  let interviews: Awaited<ReturnType<typeof listMyInterviews>> = [];
  try {
    interviews = await listMyInterviews(user);
  } catch (error) {
    console.error("[minhas-entrevistas] falha ao listar:", error);
  }

  return (
    <>
      <PageHeader
        title="Minhas Entrevistas"
        description="Entrevistas de absenteísmo (faltas e atestados) pedidas pelo RH. Responda com calma: suas respostas são vistas só por você e pelo RH."
      />
      <PageBody>
        {interviews.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-strong bg-surface px-4 py-10 text-center text-sm text-foreground-subtle">
            Você não tem nenhuma entrevista.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {interviews.map((i) => (
              <Link
                key={i.id}
                href={`/minhas-entrevistas/${i.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 hover:bg-surface-muted"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">
                    {i.note.status === "ATESTADO" ? "Atestado" : "Falta"} em {formatDate(i.note.date)}
                  </span>
                  <span className="block text-xs text-foreground-subtle">Pedida em {formatDate(i.createdAt)}</span>
                </span>
                <Badge tone={STATUS[i.status].tone}>{STATUS[i.status].label}</Badge>
              </Link>
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}
