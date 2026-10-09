import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { requireUser, requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { getInterviewForUser } from "@/server/services/absence-interview.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/dates";
import { formatPersonName } from "@/lib/format-name";
import { InterviewAnswersForm } from "@/components/domain/interview-answers-form";
import { InterviewEvaluationForm } from "@/components/domain/interview-evaluation-form";
import { AnswersSummary, EvaluationSummary } from "@/components/domain/interview-summary";
import { ReopenInterviewButton } from "./reopen-button";
import type { EmployeeAnswers, Evaluation } from "@/domain/absence-interview/form";

const STATUS: Record<string, { label: string; tone: "warning" | "info" | "success" }> = {
  SOLICITADA: { label: "Aguardando o colaborador", tone: "warning" },
  RESPONDIDA: { label: "Aguardando avaliação do RH", tone: "info" },
  CONCLUIDA: { label: "Concluída", tone: "success" },
};

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function EntrevistaAbsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  requirePermission(user, PERMISSIONS.HR_MANAGE);
  const loaded = await getInterviewForUser(user, id);
  if (!loaded) notFound();
  const { interview } = loaded;
  const answers = interview.answers as EmployeeAnswers | null;
  const evaluation = interview.evaluation as Evaluation | null;
  const status = STATUS[interview.status];
  const concluded = interview.status === "CONCLUIDA";

  return (
    <>
      <PageHeader
        title={`Entrevista de ABS — ${formatPersonName(interview.collaborator.name)}`}
        description={`${interview.note.status === "ATESTADO" ? "Atestado" : "Falta"} em ${formatDate(interview.note.date)}${interview.collaborator.area ? ` · ${interview.collaborator.area.name}` : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            <a
              href={`/api/entrevistas-abs/${interview.id}/docx`}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-foreground hover:bg-surface-muted"
            >
              <Download className="size-4" /> Baixar em Word
            </a>
          </div>
        }
      />
      <PageBody>
        <Card>
          <CardHeader>
            <CardTitle>Parte A — O que o colaborador responde</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {interview.status === "SOLICITADA" && !interview.collaborator.userId && (
              <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
                Este colaborador ainda não tem acesso ao sistema. Faça a entrevista com ele e registre o relato abaixo.
              </p>
            )}
            {interview.status === "SOLICITADA" && interview.collaborator.userId && (
              <p className="rounded-md bg-surface-muted px-3 py-2 text-sm text-foreground-subtle">
                O colaborador foi avisado e vai responder pelo SIGO. Se preferir, você pode preencher por ele aqui.
              </p>
            )}
            {answers && concluded ? (
              <AnswersSummary answers={answers} filledByHr={interview.filledByHr} answeredAt={interview.answeredAt} />
            ) : (
              <>
                {answers && (
                  <AnswersSummary answers={answers} filledByHr={interview.filledByHr} answeredAt={interview.answeredAt} />
                )}
                <details open={!answers} className="rounded-lg border border-border bg-surface-muted">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">
                    {answers ? "Editar o relato" : "Preencher o relato em nome do colaborador"}
                  </summary>
                  <div className="p-3">
                    <InterviewAnswersForm interviewId={interview.id} initial={answers} onBehalf />
                  </div>
                </details>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Parte B — O que o RH responde</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {concluded && evaluation ? (
              <>
                <EvaluationSummary evaluation={evaluation} concludedBy={interview.concludedBy?.name} concludedAt={interview.concludedAt} />
                <ReopenInterviewButton interviewId={interview.id} />
              </>
            ) : !answers ? (
              <p className="text-sm text-foreground-subtle">A avaliação libera depois que o relato do colaborador for registrado.</p>
            ) : (
              <InterviewEvaluationForm interviewId={interview.id} initial={evaluation} defaultDate={dayKey(interview.note.date)} />
            )}
          </CardContent>
        </Card>

        <Link href="/entrevistas-abs" className="text-sm font-medium text-accent hover:underline">
          ← Voltar para as entrevistas
        </Link>
      </PageBody>
    </>
  );
}
