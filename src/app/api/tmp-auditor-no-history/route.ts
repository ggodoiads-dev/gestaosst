import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "dd76b6c164dacd05d760a8bc5e5f8f9c6d490c29924914a464c88cff95f5f754";

// Escopo fechado: remove SOMENTE a permissão "history.view" do perfil AUDITOR. Nada mais.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const given = Buffer.from(createHash("sha256").update(token).digest("hex"));
  const expected = Buffer.from(TOKEN_SHA256);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const role = await db.role.findUniqueOrThrow({ where: { key: "AUDITOR" } });
  const permission = await db.permission.findUniqueOrThrow({ where: { key: "history.view" } });
  const removed = await db.rolePermission.deleteMany({ where: { roleId: role.id, permissionId: permission.id } });

  const remaining = await db.rolePermission.findMany({ where: { roleId: role.id }, select: { permission: { select: { key: true } } } });
  return NextResponse.json({ removed: removed.count, remaining: remaining.map((r) => r.permission.key).sort() });
}
