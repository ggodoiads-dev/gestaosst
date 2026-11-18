"use server";

import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import { InvalidUploadError, savePhotoUpload } from "@/server/services/storage";
import {
  createDpvim,
  createDpvimKind,
  deleteDpvim,
  setDpvimCancelled,
  setDpvimInvoiceQty,
  setDpvimKindActive,
  startDpvimSession,
  stopDpvimSession,
  updateDpvim,
  type DpvimInput,
  type StopInput,
} from "@/server/services/dpvim.service";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const GENERIC = "Não foi possível salvar. Se a atualização do banco de dados da DPVIM ainda não foi feita, ela precisa ser aplicada primeiro.";

async function run<T extends object>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    const result = await fn();
    revalidatePath("/dpvim");
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof InvalidUploadError) return { ok: false, error: error.message };
    if (error instanceof Error && /Escolha|Informe|informe|já está|já foi|Já existe|Tem gente|chegada|número inteiro|Peça|foto/.test(error.message)) return { ok: false, error: error.message };
    console.error("[dpvim] falha:", error);
    return { ok: false, error: GENERIC };
  }
}

export async function createDpvimAction(input: DpvimInput) {
  return run(async () => {
    const created = await createDpvim(await requireUser(), input);
    return { id: created.id };
  });
}

export async function updateDpvimAction(id: string, input: DpvimInput) {
  return run(async () => {
    await updateDpvim(await requireUser(), id, input);
    return {};
  });
}

export async function setDpvimCancelledAction(id: string, cancelled: boolean) {
  return run(async () => {
    await setDpvimCancelled(await requireUser(), id, cancelled);
    return {};
  });
}

/** Abre a DPVIM: a foto de confirmação vem junto (obrigatória). */
export async function startDpvimSessionAction(dpvimId: string, partnerId: string | null, formData: FormData) {
  return run(async () => {
    const user = await requireUser();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Tire a foto de confirmação para começar.");
    const saved = await savePhotoUpload(file);
    const session = await startDpvimSession(user, dpvimId, { filename: saved.filename, path: saved.path }, partnerId);
    return { id: session.id };
  });
}

export async function stopDpvimSessionAction(sessionId: string, input: StopInput) {
  return run(async () => {
    const result = await stopDpvimSession(await requireUser(), sessionId, input);
    return { concluded: result.concluded };
  });
}

export async function deleteDpvimAction(id: string) {
  return run(async () => {
    await deleteDpvim(await requireUser(), id);
    return {};
  });
}

export async function setDpvimInvoiceQtyAction(id: string, items: { kind: string; qty: number | null }[]) {
  return run(async () => {
    await setDpvimInvoiceQty(await requireUser(), id, items);
    return {};
  });
}

export async function createDpvimKindAction(label: string) {
  return run(async () => {
    await createDpvimKind(await requireUser(), label);
    return {};
  });
}

export async function setDpvimKindActiveAction(id: string, active: boolean) {
  return run(async () => {
    await setDpvimKindActive(await requireUser(), id, active);
    return {};
  });
}
