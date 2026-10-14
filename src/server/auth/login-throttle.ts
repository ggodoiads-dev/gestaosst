import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { db } from "@/server/db";

/**
 * Proteção contra adivinhação de senha: depois de muitas tentativas erradas pro mesmo e-mail (ou vindas do mesmo
 * endereço), o login fica bloqueado por um tempo — sem nem checar a senha. Se a tabela de tentativas não estiver
 * disponível, o login segue normal (melhor não travar todo mundo por falha de infraestrutura).
 */

export const LOGIN_WINDOW_MINUTES = 15;
export const MAX_FAILURES_PER_EMAIL = 5;
export const MAX_FAILURES_PER_IP = 30;

export function isThrottled(failuresForEmail: number, failuresForIp: number): boolean {
  return failuresForEmail >= MAX_FAILURES_PER_EMAIL || failuresForIp >= MAX_FAILURES_PER_IP;
}

async function ipHash(): Promise<string | null> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip");
  if (!ip) return null;
  return createHash("sha256").update(`${ip}|${process.env.AUTH_SECRET ?? ""}`).digest("hex").slice(0, 32);
}

function since() {
  return new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60 * 1000);
}

/** true = bloqueado agora. */
export async function isLoginBlocked(email: string): Promise<boolean> {
  try {
    const key = email.trim().toLowerCase();
    const ip = await ipHash();
    const [byEmail, byIp] = await Promise.all([
      db.loginAttempt.count({ where: { emailKey: key, success: false, createdAt: { gte: since() } } }),
      ip ? db.loginAttempt.count({ where: { ipHash: ip, success: false, createdAt: { gte: since() } } }) : Promise.resolve(0),
    ]);
    return isThrottled(byEmail, byIp);
  } catch (error) {
    console.error("[login-throttle] indisponível, seguindo sem bloqueio:", error);
    return false;
  }
}

export async function recordLoginFailure(email: string): Promise<void> {
  try {
    await db.loginAttempt.create({ data: { emailKey: email.trim().toLowerCase(), ipHash: await ipHash(), success: false } });
    // Limpeza oportunista: tentativas com mais de 2 dias não servem pra nada.
    if (Math.random() < 0.05) {
      await db.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } } });
    }
  } catch (error) {
    console.error("[login-throttle] não foi possível registrar a tentativa:", error);
  }
}

/** Login certo: zera as falhas recentes desse e-mail. */
export async function clearLoginFailures(email: string): Promise<void> {
  try {
    await db.loginAttempt.deleteMany({ where: { emailKey: email.trim().toLowerCase(), success: false } });
  } catch (error) {
    console.error("[login-throttle] não foi possível limpar as tentativas:", error);
  }
}
