"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import * as collaboratorService from "@/server/services/collaborator.service";

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

const salarySchema = z.object({
  id: z.string().min(1),
  salary: z.preprocess((val) => {
    if (typeof val !== "string" || val.trim() === "") return null;
    return Number(val.replace(",", "."));
  }, z.number("Salário inválido.").nonnegative("Salário inválido.").nullable()),
});

export async function setCollaboratorSalaryAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const parsed = salarySchema.parse({
      id: formData.get("id"),
      salary: formData.get("salary"),
    });
    await collaboratorService.setCollaboratorSalary(user, parsed.id, parsed.salary);
    revalidatePath("/rh");
  });
}

export async function setCollaboratorRequiresChecklistAction(id: string, requiresChecklist: boolean): Promise<ActionResult> {
  const user = await requireUser();
  return toResult(async () => {
    await collaboratorService.setCollaboratorRequiresChecklist(user, id, requiresChecklist);
    revalidatePath("/rh");
    revalidatePath("/rh/ponto");
  });
}
