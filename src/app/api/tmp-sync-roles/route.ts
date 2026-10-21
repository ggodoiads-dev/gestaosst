import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_DESCRIPTIONS, ROLE_KEYS, ROLE_LABELS } from "@/domain/shared/permissions";

const TOKEN_SHA256 = "82c3d10dfcd62b55866700b53dff70a5011b771edbf21e3a4c981173eccf1bdf";

// Escopo fechado: cria os perfis novos (RH, Técnico de Segurança, Frota, Manutenção) e ACRESCENTA as permissões padrão de
// cada perfil (inclui o Gestor ver tudo). Nunca remove permissão de ninguém. Não mexe em usuários.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const given = Buffer.from(createHash("sha256").update(token).digest("hex"));
  const expected = Buffer.from(TOKEN_SHA256);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  for (const [key, description] of Object.entries(PERMISSION_DESCRIPTIONS)) {
    await db.permission.upsert({ where: { key }, update: { description }, create: { key, description } });
  }
  const summary: Record<string, number> = {};
  for (const roleKey of Object.values(ROLE_KEYS)) {
    const role = await db.role.upsert({
      where: { key: roleKey },
      update: {},
      create: { key: roleKey, name: ROLE_LABELS[roleKey] },
    });
    const permissions = await db.permission.findMany({ where: { key: { in: DEFAULT_ROLE_PERMISSIONS[roleKey] } } });
    for (const permission of permissions) {
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
    summary[roleKey] = permissions.length;
  }
  return NextResponse.json({ ok: true, perfis: summary });
}
