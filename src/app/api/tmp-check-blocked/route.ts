import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { getExecutionContext } from "@/server/services/checklist-execution.service";
import type { CurrentUser } from "@/domain/shared/access-control";

const TOKEN = "7d3a9f2c6e0b8a4d1f7c3e9b6a2d8f5c0e4b7a1d9f3c6e8b2a5d0f7c4e9b1a6d";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const blocked = await db.equipment.findMany({
    where: { status: "BLOQUEADO" },
    select: { id: true, code: true, name: true, areaId: true, area: { select: { name: true } } },
  });

  if (url.searchParams.get("verifyGuard") !== "1") {
    return NextResponse.json({ count: blocked.length, blocked });
  }

  const adminDbUser = await db.user.findFirstOrThrow({
    where: { active: true, role: { rolePermissions: { some: { permission: { key: "equipment.view_all_areas" } } } } },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } }, userAreas: true, userFunctions: true, userRollCallAreas: true, userRollCallTurnos: true },
  });
  const adminUser: CurrentUser = {
    id: adminDbUser.id,
    name: adminDbUser.name,
    email: adminDbUser.email,
    active: adminDbUser.active,
    roleId: adminDbUser.roleId,
    roleKey: adminDbUser.role.key,
    roleName: adminDbUser.role.name,
    unitId: adminDbUser.unitId,
    permissions: new Set(adminDbUser.role.rolePermissions.map((rp) => rp.permission.key)),
    areaIds: new Set(adminDbUser.userAreas.map((ua) => ua.areaId)),
    functionIds: new Set(adminDbUser.userFunctions.map((uf) => uf.functionId)),
    canRollCall: adminDbUser.canRollCall,
    rollCallAreaIds: new Set(adminDbUser.userRollCallAreas.map((a) => a.areaId)),
    rollCallTurnoIds: new Set(adminDbUser.userRollCallTurnos.map((t) => t.turnoId)),
  };

  const guardResults = await Promise.all(
    blocked.map(async (eq) => {
      try {
        const ctx = await getExecutionContext(adminUser, eq.id);
        return { equipment: eq.code, blocked: ctx.blocked, hasExecution: ctx.execution !== null };
      } catch (e) {
        return { equipment: eq.code, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );

  return NextResponse.json({ count: blocked.length, blocked, guardResults });
}
