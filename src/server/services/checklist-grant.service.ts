import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";

/**
 * "Qual check pode realizar?": checklists que o administrador libera para um usuário além dos que ele já vê pela área e pelo cargo.
 * É só liberação (aparece em "Realizar Checklist" e dá para iniciar): não vira cobrança e não entra nos indicadores dele.
 * Leitura tolerante: se a tabela ainda não existe no banco, ninguém tem liberação extra (e nada quebra).
 */
export async function listUserChecklistGrants(userId: string): Promise<Set<string>> {
  try {
    return new Set((await db.userChecklistGrant.findMany({ where: { userId }, select: { templateId: true } })).map((g) => g.templateId));
  } catch (error) {
    console.error("[checklist-grant] tabela indisponível:", error);
    return new Set();
  }
}

/** As liberações de todos os usuários (para abrir a edição já marcada e mostrar a contagem na lista). */
export async function listAllChecklistGrants(): Promise<Record<string, string[]>> {
  try {
    const rows = await db.userChecklistGrant.findMany({ select: { userId: true, templateId: true } });
    const map: Record<string, string[]> = {};
    for (const r of rows) (map[r.userId] ??= []).push(r.templateId);
    return map;
  } catch (error) {
    console.error("[checklist-grant] tabela indisponível:", error);
    return {};
  }
}

export type GrantableTemplate = { id: string; name: string; scope: "EQUIPAMENTO" | "AREA"; areaName: string | null };

/** Os checklists publicados que dá para liberar. */
export async function listGrantableTemplates(): Promise<GrantableTemplate[]> {
  const rows = await db.checklistTemplate.findMany({
    where: { status: "PUBLICADO" },
    select: { id: true, name: true, scope: true, area: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, scope: r.scope as "EQUIPAMENTO" | "AREA", areaName: r.area?.name ?? null }));
}

/** Troca o conjunto de checklists liberados do usuário. Só quem administra usuários. */
export async function setUserChecklistGrants(admin: CurrentUser, userId: string, templateIds: string[]) {
  requirePermission(admin, PERMISSIONS.USER_MANAGE);
  const wanted = [...new Set(templateIds.filter(Boolean))];
  const before = await listUserChecklistGrants(userId);
  if (before.size === wanted.length && wanted.every((id) => before.has(id))) return;
  const valid = new Set((await listGrantableTemplates()).map((t) => t.id));
  const next = wanted.filter((id) => valid.has(id));
  await db.$transaction(async (tx) => {
    await tx.userChecklistGrant.deleteMany({ where: { userId } });
    if (next.length > 0) await tx.userChecklistGrant.createMany({ data: next.map((templateId) => ({ userId, templateId })) });
  });
  await recordAudit({ userId: admin.id, action: "UPDATE", entityType: "UserChecklistGrant", entityId: userId, previousValue: { templateIds: [...before] }, newValue: { templateIds: next } });
}
