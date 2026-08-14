import { requireUser } from "@/server/auth/current-user";
import { getExecutionContext } from "@/server/services/checklist-execution.service";
import { getEquipmentPhoto } from "@/server/services/equipment.service";
import { attachmentUrl } from "@/lib/attachment-url";
import { ChecklistRunner, type RunnerAnswer, type RunnerQuestion } from "./checklist-runner";

export default async function RealizarChecklistEquipamentoPage({
  params,
}: {
  params: Promise<{ equipmentId: string }>;
}) {
  const { equipmentId } = await params;
  const user = await requireUser();
  const [{ equipment, version, execution }, photo] = await Promise.all([
    getExecutionContext(user, equipmentId),
    getEquipmentPhoto(equipmentId),
  ]);

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
