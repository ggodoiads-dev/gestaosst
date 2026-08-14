"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { authenticateUser } from "@/server/services/auth.service";
import { createSession, destroySession } from "@/server/auth/session";
import { recordAudit } from "@/server/services/audit";

const loginSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha."),
});

export type LoginFormState = {
  error: string | null;
};

export async function loginAction(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const result = await authenticateUser(parsed.data.email, parsed.data.password);

  if (!result.ok) {
    const message =
      result.error === "USUARIO_INATIVO"
        ? "Este usuário está inativo. Procure o administrador do sistema."
        : "E-mail ou senha incorretos.";
    return { error: message };
  }

  await createSession(result.userId);
  await recordAudit({
    userId: result.userId,
    action: "LOGIN",
    entityType: "User",
    entityId: result.userId,
  });

  const next = formData.get("next");
  const safeNext = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/inicio";
  redirect(safeNext);
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
