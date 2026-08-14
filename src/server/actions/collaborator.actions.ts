"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import * as collaboratorService from "@/server/services/collaborator.service";
import { parseDateOnly } from "@/lib/dates";

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

const collaboratorSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do colaborador."),
  matricula: z.string().trim().optional().nullable(),
  functionId: z.string().trim().optional().nullable(),
  cpf: z.string().trim().optional().nullable(),
  ctps: z.string().trim().optional().nullable(),
  ctpsSerie: z.string().trim().optional().nullable(),
  admissionDate: z.string().trim().optional().nullable(),
  areaId: z.string().optional().nullable(),
  turnoId: z.string().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  checklistEnabled: z.boolean().optional(),
});

function parseCollaboratorForm(formData: FormData) {
  const parsed = collaboratorSchema.parse({
    name: formData.get("name"),
    matricula: formData.get("matricula") || null,
    functionId: formData.get("functionId") || null,
    cpf: formData.get("cpf") || null,
    ctps: formData.get("ctps") || null,
    ctpsSerie: formData.get("ctpsSerie") || null,
    admissionDate: formData.get("admissionDate") || null,
    areaId: formData.get("areaId") || null,
    turnoId: formData.get("turnoId") || null,
    phone: formData.get("phone") || null,
    checklistEnabled: formData.get("checklistEnabled") === "on",
  });

  return {
    name: parsed.name,
    matricula: parsed.matricula,
    functionId: parsed.functionId,
    cpf: parsed.cpf,
    ctps: parsed.ctps,
    ctpsSerie: parsed.ctpsSerie,
    areaId: parsed.areaId,
    turnoId: parsed.turnoId,
    phone: parsed.phone,
    checklistEnabled: parsed.checklistEnabled ?? false,
    admissionDate: parsed.admissionDate ? parseDateOnly(parsed.admissionDate) : null,
  };
}

export async function createCollaboratorAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const data = parseCollaboratorForm(formData);
    await collaboratorService.createCollaborator(user, data);
    revalidatePath("/colaboradores");
  });
}

export async function updateCollaboratorAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const id = String(formData.get("id"));
    const data = parseCollaboratorForm(formData);
    await collaboratorService.updateCollaborator(user, id, data);
    revalidatePath("/colaboradores");
    revalidatePath(`/colaboradores/${id}`);
  });
}

export async function setCollaboratorActiveAction(id: string, active: boolean) {
  const user = await requireUser();
  await collaboratorService.setCollaboratorActive(user, id, active);
  revalidatePath("/colaboradores");
  revalidatePath(`/colaboradores/${id}`);
}

export type CredentialsResult = { ok: true; email: string; password: string } | { ok: false; error: string };

export async function provisionCollaboratorAccessAction(collaboratorId: string): Promise<CredentialsResult> {
  try {
    const user = await requireUser();
    const { email, password } = await collaboratorService.provisionCollaboratorAccess(user, collaboratorId);
    revalidatePath("/colaboradores");
    revalidatePath(`/colaboradores/${collaboratorId}`);
    revalidatePath("/usuarios");
    return { ok: true, email, password };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    if (error instanceof Error) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Não foi possível criar o acesso." };
  }
}

export async function resetCollaboratorAccessPasswordAction(collaboratorId: string): Promise<CredentialsResult> {
  try {
    const user = await requireUser();
    const { email, password } = await collaboratorService.resetCollaboratorAccessPassword(user, collaboratorId);
    return { ok: true, email, password };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    if (error instanceof Error) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Não foi possível redefinir a senha." };
  }
}
