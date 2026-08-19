import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";
import { getAreaChecklistContext } from "@/server/services/checklist-execution.service";
import { AreaChecklistForm, type AreaChecklistItemData } from "./area-checklist-form";

export default async function RealizarChecklistAreaPage({
  params,
}: {
  params: Promise<{ areaId: string }>;
}) {
  const { areaId } = await params;
  const user = await requireUser();
  const { area, template, question, items } = await getAreaChecklistContext(user, areaId);

  if (!template || !question) notFound();

  const formItems: AreaChecklistItemData[] = items.map((item) => ({
    equipmentId: item.equipment.id,
    code: item.equipment.code,
    name: item.equipment.name,
    executionId: item.executionId,
    finished: item.status === "CONCLUIDO",
    initialValue: item.existingAnswer?.value ?? null,
    initialComment: item.existingAnswer?.comment ?? null,
    hasPhoto: item.existingAnswer?.hasPhoto ?? false,
  }));

  return (
    <AreaChecklistForm
      areaName={area.name}
      questionId={question.id}
      questionTitle={question.title}
      allowNotApplicable={question.allowNotApplicable}
      rules={question.rules.map((r) => ({
        triggerValue: r.triggerValue,
        requiresComment: r.requiresComment,
        requiresPhoto: r.requiresPhoto,
      }))}
      items={formItems}
    />
  );
}
