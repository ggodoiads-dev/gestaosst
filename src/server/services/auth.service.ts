import "server-only";
import { db } from "@/server/db";
import { verifyPassword } from "@/server/auth/passwords";

export type LoginResult =
  | { ok: true; userId: string }
  | { ok: false; error: "CREDENCIAIS_INVALIDAS" | "USUARIO_INATIVO" };

export async function authenticateUser(email: string, password: string): Promise<LoginResult> {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });

  if (!user) return { ok: false, error: "CREDENCIAIS_INVALIDAS" };
  if (!user.active) return { ok: false, error: "USUARIO_INATIVO" };

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) return { ok: false, error: "CREDENCIAIS_INVALIDAS" };

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  return { ok: true, userId: user.id };
}
