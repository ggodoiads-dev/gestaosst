import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import * as templateService from "@/server/services/checklist-template.service";
import type { CurrentUser } from "@/server/auth/current-user";

/**
 * Rota temporária — recria os checklists de área (Amarração, Reforma de Bulk, Reforma de
 * Paletes) usando o service de verdade (createTemplate/addQuestion/publishVersion), agora que
 * o escopo Área existe. Os 3 templates antigos (criados por equipamento, errado) já estão
 * arquivados/desativados. Remover essa rota depois de usar.
 */
const TOKEN = "7c2a9e4f1b6d8a3c5e0f7b2d9a4c1e6f8b3d0a5c2e7f9b4d1a6c3e8f0b5d2a7c";

const AREA_NAMES = ["Amarração", "Reforma de Bulk", "Reforma de Paletes"];
const QUESTION_TITLE = "Equipamento em condições de uso, sem danos ou desgaste aparente?";

async function getActorAsCurrentUser(): Promise<CurrentUser> {
  const actor = await db.user.findFirstOrThrow({
    where: { role: { key: "ADMINISTRADOR" }, active: true },
    orderBy: { createdAt: "asc" },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } }, userAreas: true, userFunctions: true },
  });
  return {
    id: actor.id,
    name: actor.name,
    email: actor.email,
    active: actor.active,
    roleId: actor.roleId,
    roleKey: actor.role.key,
    roleName: actor.role.name,
    unitId: actor.unitId,
    permissions: new Set(actor.role.rolePermissions.map((rp) => rp.permission.key)),
    areaIds: new Set(actor.userAreas.map((a) => a.areaId)),
    functionIds: new Set(actor.userFunctions.map((f) => f.functionId)),
    canRollCall: actor.canRollCall,
    rollCallAreaIds: new Set(),
    rollCallTurnoIds: new Set(),
  };
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const action = request.nextUrl.searchParams.get("action") === "create" ? "create" : "plan";

  const areas = await db.area.findMany({ where: { name: { in: AREA_NAMES }, active: true } });
  const existing = await db.checklistTemplate.findMany({ where: { areaId: { in: areas.map((a) => a.id) }, scope: "AREA" } });
  const existingAreaIds = new Set(existing.map((t) => t.areaId));

  const plan = areas.map((area) => ({
    areaId: area.id,
    areaName: area.name,
    alreadyExists: existingAreaIds.has(area.id),
  }));

  if (action === "plan") {
    return NextResponse.json({ action, missingAreas: AREA_NAMES.filter((n) => !areas.some((a) => a.name === n)), plan });
  }

  const user = await getActorAsCurrentUser();
  const results = [];

  for (const row of plan) {
    if (row.alreadyExists) {
      results.push({ areaName: row.areaName, skipped: true });
      continue;
    }
    try {
      const template = await templateService.createTemplate(user, {
        name: `Checklist de ${row.areaName}`,
        description: `Checklist padrão pros equipamentos da área ${row.areaName}.`,
        scope: "AREA",
        areaId: row.areaId,
      });

      const version = await db.checklistVersion.findFirstOrThrow({ where: { templateId: template.id } });

      await templateService.addQuestion(user, version.id, {
        title: QUESTION_TITLE,
        type: "CONFORME_NAO_CONFORME",
        required: true,
        allowNotApplicable: true,
        rule: {
          triggerValue: "NAO_CONFORME",
          isCritical: false,
          requiresComment: true,
          requiresPhoto: true,
          createsNonconformity: true,
          blocksEquipment: false,
        },
      });

      await templateService.publishVersion(user, version.id);

      results.push({ areaName: row.areaName, templateId: template.id, ok: true });
    } catch (error) {
      results.push({ areaName: row.areaName, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return NextResponse.json({ action, results });
}
