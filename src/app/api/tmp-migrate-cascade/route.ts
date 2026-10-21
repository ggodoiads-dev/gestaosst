import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { PERMISSIONS, PERMISSION_DESCRIPTIONS } from "@/domain/shared/permissions";

const TOKEN_SHA256 = "fee10a0c5a8acca0a7f1e6b48c8092ba693a4c4541bbccb5ef3a379a0642e19c";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "CascadeNode" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerUserId" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'NUMBER',
    "polarity" TEXT NOT NULL DEFAULT 'HIGHER',
    "pace" TEXT NOT NULL DEFAULT 'NONE',
    "target" DOUBLE PRECISION,
    "impact" TEXT,
    "sigoKey" TEXT,
    "seedKey" TEXT,
    "reviewNote" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CascadeNode_pkey" PRIMARY KEY ("id")
);`,
  `CREATE TABLE IF NOT EXISTS "CascadeValue" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CascadeValue_pkey" PRIMARY KEY ("id")
);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "CascadeNode_seedKey_key" ON "CascadeNode"("seedKey");`,
  `CREATE INDEX IF NOT EXISTS "CascadeNode_parentId_idx" ON "CascadeNode"("parentId");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "CascadeValue_nodeId_periodKey_key" ON "CascadeValue"("nodeId", "periodKey");`,
  `ALTER TABLE "CascadeNode" ADD CONSTRAINT "CascadeNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CascadeNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "CascadeNode" ADD CONSTRAINT "CascadeNode_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;`,
  `ALTER TABLE "CascadeValue" ADD CONSTRAINT "CascadeValue_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "CascadeNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "CascadeValue" ADD CONSTRAINT "CascadeValue_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`,
];

// Escopo fechado: cria as tabelas do cascateamento (se não existirem) e a permissão cascade.manage (perfis Gestor e
// Administrador). Idempotente. Nada mais.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const given = Buffer.from(createHash("sha256").update(token).digest("hex"));
  const expected = Buffer.from(TOKEN_SHA256);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const results: string[] = [];
  for (const sql of STATEMENTS) {
    try {
      await db.$executeRawUnsafe(sql);
      results.push("ok");
    } catch (error) {
      results.push(error instanceof Error && /already exists/i.test(error.message) ? "já existia" : "erro: " + String(error));
    }
  }
  const permission = await db.permission.upsert({
    where: { key: PERMISSIONS.CASCADE_MANAGE },
    update: {},
    create: { key: PERMISSIONS.CASCADE_MANAGE, description: PERMISSION_DESCRIPTIONS[PERMISSIONS.CASCADE_MANAGE] },
  });
  const roles = await db.role.findMany({ where: { key: { in: ["GESTOR", "ADMINISTRADOR"] } } });
  for (const role of roles) {
    await db.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      update: {},
      create: { roleId: role.id, permissionId: permission.id },
    });
  }
  return NextResponse.json({ ok: true, statements: results, roles: roles.map((r) => r.key) });
}
