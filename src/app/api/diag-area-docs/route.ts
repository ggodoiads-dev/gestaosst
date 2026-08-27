import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import * as epiService from "@/server/services/epi.service";

const TOKEN = "7d3a9f2c6e0b8a4d1f7c3e9b6a2d8f5c0e4b7a1d9f3c6e8b2a5d0f7c4e9b1a6d";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const jobFunction = await db.jobFunction.findFirst({
    where: { name: { contains: "empilhadeira", mode: "insensitive" } },
    select: { id: true, name: true, requiresNr: true },
  });

  const area = await db.area.findFirst({
    where: { name: { contains: "Paletes", mode: "insensitive" } },
    select: { id: true, name: true, attachments: { select: { id: true, docType: true, filename: true, uploadedAt: true } } },
  });

  let toggleTest: unknown = "skipped (no admin user found)";
  if (jobFunction) {
    const user = await db.user.findFirst({
      where: { active: true, role: { rolePermissions: { some: { permission: { key: "epi.manage" } } } } },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } }, userAreas: true, userFunctions: true, userRollCallAreas: true, userRollCallTurnos: true },
    });
    if (!user) {
      toggleTest = { error: "no user with epi.manage permission found" };
    } else {
      const currentUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        active: user.active,
        roleId: user.roleId,
        roleName: user.role.name,
        roleKey: user.role.key,
        unitId: user.unitId,
        canRollCall: user.canRollCall,
        permissions: new Set(user.role.rolePermissions.map((rp) => rp.permission.key)),
        areaIds: new Set(user.userAreas.map((a) => a.areaId)),
        functionIds: new Set(user.userFunctions.map((f) => f.functionId)),
        rollCallAreaIds: new Set(user.userRollCallAreas.map((a) => a.areaId)),
        rollCallTurnoIds: new Set(user.userRollCallTurnos.map((t) => t.turnoId)),
      };
      try {
        const before = jobFunction.requiresNr;
        const updated = await epiService.setJobFunctionRequiresNr(currentUser, jobFunction.id, !before);
        toggleTest = { ok: true, before, after: updated.requiresNr };
        // desfaz pra nao bagunçar o dado de verdade
        await db.jobFunction.update({ where: { id: jobFunction.id }, data: { requiresNr: before } });
      } catch (e) {
        toggleTest = { ok: false, error: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack : undefined };
      }
    }
  }

  return NextResponse.json({ ok: true, jobFunction, area, toggleTest });
}
