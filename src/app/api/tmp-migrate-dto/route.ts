import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { PERMISSION_DESCRIPTIONS } from "@/domain/shared/permissions";

const TOKEN_SHA256 = "0e07a06376bcfd009e4540a3aa1ce266e60a4cb104121c03eac7db0729741e8c";

// Escopo fechado: (1) cria a tabela DtoEvaluation (idempotente); (2) cria as permissões dto.view / dto.manage e
// concede: dto.manage -> GESTOR e ADMINISTRADOR; dto.view -> AUDITOR e ADMINISTRADOR. Nada mais.
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "DtoEvaluation" (
    "id" TEXT NOT NULL,
    "externalKey" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "evaluatedName" TEXT NOT NULL,
    "evaluatedRole" TEXT,
    "evaluatorName" TEXT,
    "evaluatorRole" TEXT,
    "leaderName" TEXT,
    "company" TEXT,
    "operation" TEXT,
    "activity" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "yesCount" INTEGER NOT NULL DEFAULT 0,
    "noCount" INTEGER NOT NULL DEFAULT 0,
    "naCount" INTEGER NOT NULL DEFAULT 0,
    "scorePercent" INTEGER,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedById" TEXT NOT NULL,
    CONSTRAINT "DtoEvaluation_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "DtoEvaluation_externalKey_key" ON "DtoEvaluation"("externalKey")`,
  `CREATE INDEX IF NOT EXISTS "DtoEvaluation_collaboratorId_idx" ON "DtoEvaluation"("collaboratorId")`,
  `CREATE INDEX IF NOT EXISTS "DtoEvaluation_date_idx" ON "DtoEvaluation"("date")`,
  ...[
    ["collaboratorId", `"Collaborator"("id")`],
    ["importedById", `"User"("id")`],
  ].map(
    ([column, target]) => `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DtoEvaluation_${column}_fkey') THEN
      ALTER TABLE "DtoEvaluation" ADD CONSTRAINT "DtoEvaluation_${column}_fkey" FOREIGN KEY ("${column}") REFERENCES ${target} ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  END $$`,
  ),
];

const GRANTS: Record<string, string[]> = {
  "dto.manage": ["GESTOR", "ADMINISTRADOR"],
  "dto.view": ["AUDITOR", "ADMINISTRADOR"],
};

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const given = Buffer.from(createHash("sha256").update(token).digest("hex"));
  const expected = Buffer.from(TOKEN_SHA256);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  for (const statement of STATEMENTS) await db.$executeRawUnsafe(statement);

  const granted: Record<string, string[]> = {};
  for (const [key, roleKeys] of Object.entries(GRANTS)) {
    const permission = await db.permission.upsert({
      where: { key },
      update: { description: PERMISSION_DESCRIPTIONS[key as keyof typeof PERMISSION_DESCRIPTIONS] },
      create: { key, description: PERMISSION_DESCRIPTIONS[key as keyof typeof PERMISSION_DESCRIPTIONS] },
    });
    granted[key] = [];
    for (const roleKey of roleKeys) {
      const role = await db.role.findUnique({ where: { key: roleKey } });
      if (!role) continue;
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
      granted[key].push(roleKey);
    }
  }

  const rows = await db.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*)::bigint AS count FROM "DtoEvaluation"`);
  return NextResponse.json({ ok: true, table: "DtoEvaluation", rows: Number(rows[0].count), granted });
}
