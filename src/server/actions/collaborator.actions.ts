"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import type { CurrentUser } from "@/server/auth/current-user";
import * as collaboratorService from "@/server/services/collaborator.service";
import { savePhotoUpload } from "@/server/services/storage";
import { parseDateOnly } from "@/lib/dates";

export type ActionResult = { ok: true } | { ok: false; error: string };

// Campos únicos de Collaborator que colidem com dados digitados no formulário (qrToken/userId
// são gerados pelo sistema, nunca vêm do form). O adapter de driver do Prisma às vezes não
// popula `error.meta.target` — por isso também procura o nome do campo na mensagem crua, que o
// Prisma sempre inclui ("Unique constraint failed on the fields: (`matricula`)").
const UNIQUE_FIELD_LABELS: Record<string, string> = {
  matricula: "matrícula",
  pis: "PIS",
};

function toResult(fn: () => Promise<unknown>): Promise<ActionResult> {
  return fn()
    .then(() => ({ ok: true as const }))
    .catch((error: unknown) => {
      if (error instanceof ForbiddenError) return { ok: false as const, error: error.message };
      if (error instanceof z.ZodError) {
        return { ok: false as const, error: error.issues[0]?.message ?? "Dados inválidos." };
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = error.meta?.target;
        const haystack = `${Array.isArray(target) ? target.join(",") : String(target ?? "")} ${error.message}`;
        const field = Object.keys(UNIQUE_FIELD_LABELS).find((key) => haystack.includes(key));
        const label = field ? UNIQUE_FIELD_LABELS[field] : "um dos campos";
        return { ok: false as const, error: `Já existe outro colaborador cadastrado com essa ${label}.` };
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

/** Foto é opcional: se o envio falhar, o cadastro/edição do colaborador não é desfeito por causa disso. */
async function maybeAttachPhoto(user: CurrentUser, collaboratorId: string, formData: FormData) {
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return;

  try {
    const saved = await savePhotoUpload(photo);
    await collaboratorService.attachCollaboratorPhoto(user, collaboratorId, saved);
  } catch (error) {
    console.error("Falha ao anexar foto do colaborador:", error);
  }
}

export async function createCollaboratorAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const data = parseCollaboratorForm(formData);
    const created = await collaboratorService.createCollaborator(user, data);
    await maybeAttachPhoto(user, created.id, formData);
    revalidatePath("/colaboradores");
  });
}

export async function updateCollaboratorAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const id = String(formData.get("id"));
    const data = parseCollaboratorForm(formData);
    await collaboratorService.updateCollaborator(user, id, data);
    await maybeAttachPhoto(user, id, formData);
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

export type BulkProvisionResult =
  | { ok: true; created: { name: string; email: string }[]; alreadyLinked: number }
  | { ok: false; error: string };

export async function provisionAllCollaboratorsAccessAction(): Promise<BulkProvisionResult> {
  try {
    const user = await requireUser();
    const { created, alreadyLinked } = await collaboratorService.provisionAllCollaboratorsAccess(user);
    revalidatePath("/colaboradores");
    revalidatePath("/usuarios");
    return { ok: true, created, alreadyLinked };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    if (error instanceof Error) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Não foi possível criar os acessos." };
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
