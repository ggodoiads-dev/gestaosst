"use server";

import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import { justifyChecklistItem, removeChecklistItemJustification, removeChecklistItemJustifications } from "@/server/services/checklist-compliance.service";
import type { ChecklistJustificationReason } from "@/domain/time-clock/checklist-justification-reasons";

export type ChecklistItemJustificationResult = { ok: true } | { ok: false; error: string };

function revalidate(collaboratorId: string) {
  revalidatePath(`/indicadores/checklist/${collaboratorId}`);
  revalidatePath("/indicadores");
  revalidatePath("/inicio");
}

export async function justifyChecklistItemAction(input: {
  collaboratorId: string;
  dayKey: string;
  itemIds: string[];
  reason: ChecklistJustificationReason;
  note: string;
}): Promise<ChecklistItemJustificationResult> {
  try {
    const user = await requireUser();
    await justifyChecklistItem(user, input);
    revalidate(input.collaboratorId);
    return { ok: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    if (error instanceof Error && /Explique|Data inválida|não era exigido|Escolha ao menos/.test(error.message)) {
      return { ok: false, error: error.message };
    }
    console.error("[checklist-justification] falha ao justificar item:", error);
    return { ok: false, error: "Não foi possível salvar a justificativa." };
  }
}

export async function removeChecklistItemJustificationAction(input: {
  collaboratorId: string;
  dayKey: string;
  itemId: string;
}): Promise<ChecklistItemJustificationResult> {
  try {
    const user = await requireUser();
    await removeChecklistItemJustification(user, input);
    revalidate(input.collaboratorId);
    return { ok: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[checklist-justification] falha ao desfazer justificativa:", error);
    return { ok: false, error: "Não foi possível desfazer a justificativa." };
  }
}

/** Desfaz várias justificativas de uma pessoa num dia (todas, ou só as de `itemIds`). */
export async function removeChecklistItemJustificationsAction(input: {
  collaboratorId: string;
  dayKey: string;
  itemIds?: string[];
}): Promise<ChecklistItemJustificationResult & { removed?: number }> {
  try {
    const user = await requireUser();
    const removed = await removeChecklistItemJustifications(user, input);
    revalidate(input.collaboratorId);
    return { ok: true, removed };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[checklist-justification] falha ao desfazer justificativas:", error);
    return { ok: false, error: "Não foi possível desfazer as justificativas." };
  }
}
