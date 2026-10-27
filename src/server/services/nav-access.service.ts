import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { ALWAYS_ALLOWED_HREFS } from "@/domain/shared/nav-access";
import { getNavGroups } from "@/components/layout/nav-items";

/**
 * Acesso por abas do Auditor. O administrador marca, ao criar/editar o usuário, quais abas do menu ele pode ver; o resto some do menu e é barrado no
 * servidor (ver o layout do app). Sem nenhuma aba guardada = sem restrição. Só vale para o perfil Auditor.
 */

const RESTRICTED_ROLE_KEY = "AUDITOR";

export type SelectableNavGroup = { key: string; title: string; items: { href: string; label: string }[] };

/** Abas marcadas do usuário, ou `null` se ele não tem restrição. Leitura tolerante: se a tabela ainda não existir no banco, ninguém fica restrito (nem travado). */
export async function getUserNavWhitelist(user: Pick<CurrentUser, "id" | "roleKey">): Promise<string[] | null> {
  if (user.roleKey !== RESTRICTED_ROLE_KEY) return null;
  try {
    const rows = await db.userNavAccess.findMany({ where: { userId: user.id }, select: { href: true } });
    return rows.length > 0 ? rows.map((r) => r.href) : null;
  } catch (error) {
    console.error("[nav-access] tabela indisponível:", error);
    return null;
  }
}

/** O Rico (chat) responde sobre dados do sistema todo: quem tem restrição só usa se a aba do Rico estiver marcada. */
export async function canUseRico(user: Pick<CurrentUser, "id" | "roleKey">): Promise<boolean> {
  const whitelist = await getUserNavWhitelist(user);
  return whitelist === null || whitelist.includes("/rico");
}

/** As abas que um perfil enxerga hoje (as que dá para marcar ou desmarcar), agrupadas como no menu. */
export async function listSelectableNavGroups(roleKey: string): Promise<SelectableNavGroup[]> {
  const role = await db.role.findUnique({ where: { key: roleKey }, include: { rolePermissions: { include: { permission: true } } } });
  if (!role) return [];
  const fakeUser = {
    permissions: new Set(role.rolePermissions.map((rp) => rp.permission.key)),
    canRollCall: false,
    roleKey,
  } as unknown as CurrentUser;
  const always = ALWAYS_ALLOWED_HREFS as readonly string[];
  return getNavGroups(fakeUser)
    .map((g) => ({
      key: g.key,
      title: g.title ?? (g.key === "geral" ? "Geral" : g.key),
      items: g.items.filter((i) => !always.includes(i.href)).map((i) => ({ href: i.href, label: i.label })),
    }))
    .filter((g) => g.items.length > 0);
}

/** Abas guardadas de cada usuário restrito (para abrir a edição já marcada). */
export async function listNavWhitelists(): Promise<Record<string, string[]>> {
  try {
    const rows = await db.userNavAccess.findMany({ select: { userId: true, href: true } });
    const map: Record<string, string[]> = {};
    for (const r of rows) (map[r.userId] ??= []).push(r.href);
    return map;
  } catch (error) {
    console.error("[nav-access] tabela indisponível:", error);
    return {};
  }
}

/**
 * Guarda as abas do usuário. Só o perfil Auditor tem restrição: para qualquer outro perfil, tudo é limpo. Marcar todas as abas = sem restrição.
 * `/inicio` entra sempre na lista guardada para que "restrito" nunca se confunda com "sem linhas".
 */
export async function setUserNavWhitelist(admin: CurrentUser, userId: string, hrefs: string[]) {
  requirePermission(admin, PERMISSIONS.USER_MANAGE);
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { role: true } });

  let toStore: string[] = [];
  if (user.role.key === RESTRICTED_ROLE_KEY) {
    const selectable = (await listSelectableNavGroups(RESTRICTED_ROLE_KEY)).flatMap((g) => g.items.map((i) => i.href));
    const chosen = [...new Set(hrefs)].filter((h) => selectable.includes(h));
    if (chosen.length < selectable.length) toStore = [...chosen, "/inicio"];
  }

  await db.$transaction(async (tx) => {
    await tx.userNavAccess.deleteMany({ where: { userId } });
    if (toStore.length > 0) await tx.userNavAccess.createMany({ data: toStore.map((href) => ({ userId, href })) });
  });
  await recordAudit({
    userId: admin.id,
    action: "UPDATE",
    entityType: "UserNavAccess",
    entityId: userId,
    newValue: { restricted: toStore.length > 0, hrefs: toStore },
  });
  return { restricted: toStore.length > 0, count: toStore.length };
}
