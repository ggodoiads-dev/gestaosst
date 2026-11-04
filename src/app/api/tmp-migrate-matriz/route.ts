import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "18c0daf32ede5676b4b2ffe57623b6ba1ca6dcacfb197321325c8610c8254340";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "SkillMatrix" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SkillMatrix_pkey" PRIMARY KEY ("id")
);`,
  `CREATE TABLE IF NOT EXISTS "SkillMatrixSkill" (
    "id" TEXT NOT NULL,
    "matrixId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SkillMatrixSkill_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SkillMatrixSkill_matrixId_fkey" FOREIGN KEY ("matrixId") REFERENCES "SkillMatrix"("id") ON DELETE CASCADE ON UPDATE CASCADE
);`,
  `CREATE INDEX IF NOT EXISTS "SkillMatrixSkill_matrixId_idx" ON "SkillMatrixSkill"("matrixId");`,
  `CREATE TABLE IF NOT EXISTS "SkillMatrixMember" (
    "id" TEXT NOT NULL,
    "matrixId" TEXT NOT NULL,
    "collaboratorId" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "grp" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SkillMatrixMember_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SkillMatrixMember_matrixId_fkey" FOREIGN KEY ("matrixId") REFERENCES "SkillMatrix"("id") ON DELETE CASCADE ON UPDATE CASCADE
);`,
  `CREATE INDEX IF NOT EXISTS "SkillMatrixMember_matrixId_idx" ON "SkillMatrixMember"("matrixId");`,
  `CREATE TABLE IF NOT EXISTS "SkillMatrixLevel" (
    "memberId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    CONSTRAINT "SkillMatrixLevel_pkey" PRIMARY KEY ("memberId","skillId"),
    CONSTRAINT "SkillMatrixLevel_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "SkillMatrixMember"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SkillMatrixLevel_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "SkillMatrixSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE
);`,
  `CREATE TABLE IF NOT EXISTS "FunctionSpecialist" (
    "id" TEXT NOT NULL,
    "collaboratorId" TEXT,
    "name" TEXT NOT NULL,
    "functionName" TEXT,
    "grp" TEXT NOT NULL,
    "skill" TEXT,
    "action" TEXT,
    "dueDate" TIMESTAMP(3),
    "dueNote" TEXT,
    "follow" TEXT,
    "status" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FunctionSpecialist_pkey" PRIMARY KEY ("id")
);`,
  `CREATE INDEX IF NOT EXISTS "FunctionSpecialist_grp_idx" ON "FunctionSpecialist"("grp");`,
];

// Escopo fechado: cria as tabelas da Matriz de função (SkillMatrix, SkillMatrixSkill, SkillMatrixMember, SkillMatrixLevel) e dos Especialistas de função (FunctionSpecialist), com índices e chaves, se ainda não existirem. Idempotente. Nada mais.
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
      const affected = await db.$executeRawUnsafe(sql);
      results.push(`ok (${affected})`);
    } catch (error) {
      results.push(error instanceof Error && /already exists/i.test(error.message) ? "já existia" : "erro: " + String(error));
    }
  }
  return NextResponse.json({ ok: true, statements: results });
}
