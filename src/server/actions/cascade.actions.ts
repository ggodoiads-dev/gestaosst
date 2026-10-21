"use server";

import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import * as service from "@/server/services/cascade.service";
import type { CascadePace, CascadePolarity, CascadeUnit } from "@/domain/cascade/status";

export type CascadeResult = { ok: true; created?: number } | { ok: false; error: string };

async function run(fn: () => Promise<{ created?: number } | void | unknown>): Promise<CascadeResult> {
  try {
    const result = (await fn()) as { created?: number } | undefined;
    revalidatePath("/cascata");
    return { ok: true, created: typeof result === "object" && result && "created" in result ? result.created : undefined };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[cascade] falha:", error);
    return { ok: false, error: "Não foi possível salvar. Tente de novo." };
  }
}

export type NodeFormInput = {
  name: string;
  description: string;
  unit: CascadeUnit;
  polarity: CascadePolarity;
  pace: CascadePace;
  target: string; // texto do campo (vírgula decimal aceita); vazio = sem meta
  ownerUserId: string; // "" = sem responsável
};

function toInput(form: NodeFormInput): service.NodeInput {
  const raw = form.target.trim().replace(/\./g, "").replace(",", ".");
  const target = raw === "" ? null : Number(raw);
  if (target !== null && !Number.isFinite(target)) throw new ForbiddenError("Meta inválida.");
  return {
    name: form.name,
    description: form.description,
    unit: form.unit,
    polarity: form.polarity,
    pace: form.pace,
    target,
    ownerUserId: form.ownerUserId || null,
  };
}

export async function createNodeAction(parentId: string, kind: "IC" | "IV", form: NodeFormInput) {
  return run(async () => service.createNode(await requireUser(), parentId, kind, toInput(form)));
}

export async function updateNodeAction(id: string, form: NodeFormInput) {
  return run(async () => service.updateNode(await requireUser(), id, toInput(form)));
}

export async function deleteNodeAction(id: string) {
  return run(async () => service.deleteNode(await requireUser(), id));
}

export async function setNodeValueAction(id: string, periodKey: string, valueText: string, note: string) {
  return run(async () => {
    const raw = valueText.trim().replace(/\./g, "").replace(",", ".");
    const value = raw === "" ? null : Number(raw);
    if (value !== null && !Number.isFinite(value)) throw new ForbiddenError("Valor inválido.");
    await service.setNodeValue(await requireUser(), id, periodKey, value, note);
  });
}

export async function seedCascadeAction() {
  return run(async () => service.seedCascade(await requireUser()));
}
