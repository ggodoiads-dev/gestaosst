"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/current-user";
import * as userService from "@/server/services/user.service";
import { ForbiddenError } from "@/server/auth/current-user";

export type ActionResult = { ok: true } | { ok: false; error: string };

function toResult(fn: () => Promise<unknown>): Promise<ActionResult> {
  return fn()
    .then(() => ({ ok: true as const }))
    .catch((error: unknown) => {
      if (error instanceof ForbiddenError) return { ok: false as const, error: error.message };
      if (error instanceof z.ZodError) {
        return { ok: false as const, error: error.issues[0]?.message ?? "Dados inválidos." };
      }
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        return { ok: false as const, error: "Já existe um usuário com este e-mail." };
      }
      console.error(error);
      return { ok: false as const, error: "Não foi possível concluir a operação." };
    });
}

function parseAreaIds(formData: FormData) {
  return formData.getAll("areaIds").map(String).filter(Boolean);
}

function parseFunctionIds(formData: FormData) {
  return formData.getAll("functionIds").map(String).filter(Boolean);
}

const createUserSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do usuário."),
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
  roleId: z.string().min(1, "Selecione o perfil."),
  unitId: z.string().optional().nullable(),
});

export async function createUserAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const admin = await requireUser();
    const data = createUserSchema.parse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      roleId: formData.get("roleId"),
      unitId: formData.get("unitId") || null,
    });
    await userService.createUser(admin, { ...data, areaIds: parseAreaIds(formData), functionIds: parseFunctionIds(formData) });
    revalidatePath("/usuarios");
  });
}

const updateUserSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do usuário."),
  email: z.string().trim().email("Informe um e-mail válido."),
  roleId: z.string().min(1, "Selecione o perfil."),
  unitId: z.string().optional().nullable(),
});

export async function updateUserAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const admin = await requireUser();
    const id = String(formData.get("id"));
    const data = updateUserSchema.parse({
      name: formData.get("name"),
      email: formData.get("email"),
      roleId: formData.get("roleId"),
      unitId: formData.get("unitId") || null,
    });
    await userService.updateUser(admin, id, {
      ...data,
      areaIds: parseAreaIds(formData),
      functionIds: parseFunctionIds(formData),
    });
    revalidatePath("/usuarios");
  });
}

export async function setUserActiveAction(id: string, active: boolean): Promise<ActionResult> {
  const admin = await requireUser();
  return toResult(() => userService.setUserActive(admin, id, active)).then((result) => {
    if (result.ok) revalidatePath("/usuarios");
    return result;
  });
}

const resetPasswordSchema = z.object({
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
});

export async function resetUserPasswordAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const admin = await requireUser();
    const id = String(formData.get("id"));
    const { password } = resetPasswordSchema.parse({ password: formData.get("password") });
    await userService.resetUserPassword(admin, id, password);
  });
}
