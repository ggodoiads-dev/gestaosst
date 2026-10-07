import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { PERMISSION_DESCRIPTIONS } from "@/domain/shared/permissions";

const TOKEN_SHA256 = "dd76b6c164dacd05d760a8bc5e5f8f9c6d490c29924914a464c88cff95f5f754";

// Escopo fechado, tudo sobre o perfil Auditor:
//  1) remove SOMENTE "history.view" do perfil AUDITOR;
//  2) cria a permissão nova "productivity.view" e a concede ao AUDITOR e ao ADMINISTRADOR. Nada mais.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const given = Buffer.from(createHash("sha256").update(token).digest("hex"));
  const expected = Buffer.from(TOKEN_SHA256);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const auditor = await db.role.findUniqueOrThrow({ where: { key: "AUDITOR" } });
  const admin = await db.role.findUniqueOrThrow({ where: { key: "ADMINISTRADOR" } });

  const history = await db.permission.findUnique({ where: { key: "history.view" } });
  const removed = history ? await db.rolePermission.deleteMany({ where: { roleId: auditor.id, permissionId: history.id } }) : { count: 0 };

  const productivityView = await db.permission.upsert({
    where: { key: "productivity.view" },
    update: { description: PERMISSION_DESCRIPTIONS["productivity.view"] },
    create: { key: "productivity.view", description: PERMISSION_DESCRIPTIONS["productivity.view"] },
  });
  for (const roleId of [auditor.id, admin.id]) {
    await db.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId: productivityView.id } },
      update: {},
      create: { roleId, permissionId: productivityView.id },
    });
  }

  const remaining = await db.rolePermission.findMany({ where: { roleId: auditor.id }, select: { permission: { select: { key: true } } } });
  return NextResponse.json({ historyRemoved: removed.count, total: remaining.length, auditorPermissions: remaining.map((r) => r.permission.key).sort() });
}
