import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { getInterviewForUser } from "@/server/services/absence-interview.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import { InterviewAnswersForm } from "@/components/domain/interview-answers-form";
import { AnswersSummary } from "@/components/domain/interview-summary";
import type { EmployeeAnswers } from "@/domain/absence-interview/form";

export default async function MinhaEntrevistaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const loaded = await getInterviewForUser(user, id);
  if (!loaded) notFound();
  const { interview } = loaded;
  const answers = interview.answers as EmployeeAnswers | null;
  const concluded = interview.status === "CONCLUIDA";

  return (
    <>
      <PageHeader
        title="Entrevista de absenteísmo"
        description={`${interview.note.status === "ATESTADO" ? "Atestado" : "Falta"} em ${formatDate(interview.note.date)}`}
        actions={
          answers ? (
            <a
              href={`/api/entrevistas-abs/${interview.id}/docx`}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-foreground hover:bg-surface-muted"
            >
              <Download className="size-4" /> Baixar em Word
            </a>
          ) : undefined
        }
      />
      <PageBody>
        <Card>
          <CardHeader>
            <CardTitle>{answers ? "Sua resposta" : "Conte o que aconteceu"}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {!answers && (
              <p className="text-sm text-foreground-subtle">
                O RH pediu esta conversa para entender o que houve e ajudar, se for o caso. Responda com sinceridade — suas
                respostas ficam só com você e com o RH.
              </p>
            )}
            {answers && (
              <AnswersSummary answers={answers} filledByHr={interview.filledByHr} answeredAt={interview.answeredAt} />
            )}
            {!concluded && (
              <details open={!answers} className="rounded-lg border border-border bg-surface-muted">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">
                  {answers ? "Corrigir minha resposta" : "Responder"}
                </summary>
                <div className="p-3">
                  <InterviewAnswersForm
                    interviewId={interview.id}
                    initial={answers}
                    defaultDate={interview.note.date.toISOString().slice(0, 10)}
                    onBehalf={false}
                  />
                </div>
              </details>
            )}
            {concluded && <p className="text-sm text-success">Esta entrevista foi concluída pelo RH.</p>}
          </CardContent>
        </Card>
        <Link href="/minhas-entrevistas" className="text-sm font-medium text-accent hover:underline">
          ← Minhas entrevistas
        </Link>
      </PageBody>
    </>
  );
}
