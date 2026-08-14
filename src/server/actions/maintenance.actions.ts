"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import * as maintenanceService from "@/server/services/maintenance.service";

export type ActionResult = { ok: true } | { ok: false; error: string };

function toResult(fn: () => Promise<unknown>): Promise<ActionResult> {
  return fn()
    .then(() => ({ ok: true as const }))
    .catch((error: unknown) => {
      if (error instanceof ForbiddenError) return { ok: false as const, error: error.message };
      if (error instanceof z.ZodError) {
        return { ok: false as const, error: error.issues[0]?.message ?? "Dados inválidos." };
      }
      console.error(error);
      return { ok: false as const, error: "Não foi possível concluir a operação." };
    });
}

function revalidateEquipmentPaths(equipmentId: string) {
  revalidatePath("/manutencao");
  revalidatePath("/equipamentos");
  revalidatePath(`/equipamentos/${equipmentId}`);
  revalidatePath("/inicio");
  revalidatePath("/equipamentos/painel");
}

export async function startMaintenanceAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const equipmentId = String(formData.get("equipmentId"));
    const note = String(formData.get("note") ?? "");
    await maintenanceService.startMaintenance(user, equipmentId, note || null);
    revalidateEquipmentPaths(equipmentId);
  });
}

const completeSchema = z.object({
  description: z.string().trim().min(3, "Descreva o que foi feito/trocado."),
  newStatus: z.enum(["LIBERADO", "BLOQUEADO", "EM_MANUTENCAO"]),
});

export async function completeMaintenanceAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const equipmentId = String(formData.get("equipmentId"));
    const data = completeSchema.parse({
      description: formData.get("description"),
      newStatus: formData.get("newStatus"),
    });
    await maintenanceService.completeMaintenance(user, equipmentId, data);
    revalidateEquipmentPaths(equipmentId);
  });
}
