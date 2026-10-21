import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { PERMISSIONS, PERMISSION_DESCRIPTIONS } from "@/domain/shared/permissions";

const TOKEN_SHA256 = "2ff86edae2f04b0790fd652281140f6a3afbb56caf90340d58eb5750a77086a4";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "DisciplinaryMeasure" (
    "id" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "referenceDate" TIMESTAMP(3) NOT NULL,
    "step" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "decidedById" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DisciplinaryMeasure_pkey" PRIMARY KEY ("id")
);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "DisciplinaryMeasure_collaboratorId_reason_referenceDate_key" ON "DisciplinaryMeasure"("collaboratorId", "reason", "referenceDate");`,
  `CREATE INDEX IF NOT EXISTS "DisciplinaryMeasure_collaboratorId_reason_idx" ON "DisciplinaryMeasure"("collaboratorId", "reason");`,
  `ALTER TABLE "DisciplinaryMeasure" ADD CONSTRAINT "DisciplinaryMeasure_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`,
  `ALTER TABLE "DisciplinaryMeasure" ADD CONSTRAINT "DisciplinaryMeasure_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`,
];

// Escopo fechado: cria a tabela DisciplinaryMeasure (se não existir) e a permissão discipline.manage (para os perfis
// Gestor e Administrador). Idempotente. Nada mais.
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
      // constraints (FK) não têm IF NOT EXISTS: se já existem, tudo bem.
      results.push(error instanceof Error && /already exists/i.test(error.message) ? "já existia" : "erro: " + String(error));
    }
  }

  const permission = await db.permission.upsert({
    where: { key: PERMISSIONS.DISCIPLINE_MANAGE },
    update: {},
    create: { key: PERMISSIONS.DISCIPLINE_MANAGE, description: PERMISSION_DESCRIPTIONS[PERMISSIONS.DISCIPLINE_MANAGE] },
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
