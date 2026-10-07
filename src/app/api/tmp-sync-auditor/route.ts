import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_DESCRIPTIONS, ROLE_KEYS, ROLE_LABELS, type PermissionKey } from "@/domain/shared/permissions";

const TOKEN_SHA256 = "ee0e7a6379767f31fe1dd4a8ab920049eedaf20d91fc8b70191a6cbc11f58547";

// Escopo fechado: só as 3 permissões novas + o perfil Auditor. Não mexe em nenhuma outra permissão/perfil.
const NEW_PERMISSION_KEYS: PermissionKey[] = ["actionplan.view", "guardian.view", "attendance.view"];

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const given = Buffer.from(createHash("sha256").update(token).digest("hex"));
  const expected = Buffer.from(TOKEN_SHA256);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  for (const key of NEW_PERMISSION_KEYS) {
    await db.permission.upsert({ where: { key }, update: { description: PERMISSION_DESCRIPTIONS[key] }, create: { key, description: PERMISSION_DESCRIPTIONS[key] } });
  }

  const auditor = await db.role.upsert({
    where: { key: ROLE_KEYS.AUDITOR },
    update: { name: ROLE_LABELS.AUDITOR },
    create: { key: ROLE_KEYS.AUDITOR, name: ROLE_LABELS.AUDITOR },
  });
  const admin = await db.role.findUniqueOrThrow({ where: { key: ROLE_KEYS.ADMINISTRADOR } });

  const auditorKeys = DEFAULT_ROLE_PERMISSIONS.AUDITOR;
  const auditorPermissions = await db.permission.findMany({ where: { key: { in: auditorKeys } } });
  for (const permission of auditorPermissions) {
    await db.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: auditor.id, permissionId: permission.id } },
      update: {},
      create: { roleId: auditor.id, permissionId: permission.id },
    });
  }

  const newPermissions = await db.permission.findMany({ where: { key: { in: NEW_PERMISSION_KEYS } } });
  for (const permission of newPermissions) {
    await db.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: admin.id, permissionId: permission.id } },
      update: {},
      create: { roleId: admin.id, permissionId: permission.id },
    });
  }

  const granted = await db.rolePermission.findMany({ where: { roleId: auditor.id }, select: { permission: { select: { key: true } } } });
  return NextResponse.json({
    role: auditor.name,
    expectedPermissions: auditorKeys.length,
    grantedPermissions: granted.map((g) => g.permission.key).sort(),
  });
}
