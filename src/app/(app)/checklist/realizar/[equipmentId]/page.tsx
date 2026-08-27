import { ShieldAlert } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { getExecutionContext } from "@/server/services/checklist-execution.service";
import { getEquipmentPhoto } from "@/server/services/equipment.service";
import { attachmentUrl } from "@/lib/attachment-url";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Badge } from "@/components/ui/badge";
import { ChecklistRunner, type RunnerAnswer, type RunnerQuestion } from "./checklist-runner";

export default async function RealizarChecklistEquipamentoPage({
  params,
}: {
  params: Promise<{ equipmentId: string }>;
}) {
  const { equipmentId } = await params;
  const user = await requireUser();
  const ctx = await getExecutionContext(user, equipmentId);

  if (ctx.blocked) {
    return (
      <>
        <PageHeader title="Realizar Checklist" description={`${ctx.equipment.code} — ${ctx.equipment.name}`} />
        <PageBody>
          <div className="flex flex-col items-center gap-3 rounded-lg border border-danger/30 bg-danger-soft p-8 text-center">
            <ShieldAlert className="size-8 text-danger" />
            <div>
              <p className="font-semibold text-foreground">Equipamento bloqueado</p>
              <p className="mt-1 max-w-md text-sm text-foreground-subtle">
                Este equipamento foi bloqueado após uma não conformidade crítica identificada num checklist
                anterior. Não é possível iniciar uma nova inspeção enquanto ele não for liberado por quem for
                responsável por validar a correção ou concluir a manutenção.
              </p>
            </div>
            <Badge tone="danger" dot>Bloqueado</Badge>
          </div>
        </PageBody>
      </>
    );
  }

  const { equipment, version, execution } = ctx;
  const photo = await getEquipmentPhoto(equipmentId);

  const questions: RunnerQuestion[] = version.questions.map((q) => ({
    id: q.id,
    order: q.order,
    title: q.title,
    description: q.description,
    guidance: q.guidance,
    type: q.type,
    required: q.required,
    allowNotApplicable: q.allowNotApplicable,
    options: q.options.map((o) => ({ id: o.id, label: o.label, value: o.value })),
    rules: q.rules.map((r) => ({
      triggerValue: r.triggerValue,
      requiresComment: r.requiresComment,
      requiresPhoto: r.requiresPhoto,
    })),
  }));

  const initialAnswers: Record<string, RunnerAnswer> = {};
  for (const answer of execution.answers) {
    initialAnswers[answer.questionId] = {
      value: answer.value,
      comment: answer.comment,
      photoUrl: answer.attachments[0] ? attachmentUrl(answer.attachments[0].path) : null,
    };
  }

  return (
    <ChecklistRunner
      equipmentId={equipment.id}
      equipmentCode={equipment.code}
      equipmentName={equipment.name}
      equipmentPhotoUrl={photo ? attachmentUrl(photo.path) : null}
      executionId={execution.id}
      questions={questions}
      initialAnswers={initialAnswers}
    />
  );
}
