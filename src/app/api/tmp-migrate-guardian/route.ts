import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "0fc065dc3caf11781a37014810ce5965e4a6fc8914389df2ffd40e87a0662d64";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "GuardianGoldenRuleReview" (
    "guardianId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "note" TEXT,
    "decidedById" TEXT NOT NULL,
    "decidedByName" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuardianGoldenRuleReview_pkey" PRIMARY KEY ("guardianId")
);`,
  `CREATE TABLE IF NOT EXISTS "GuardianLeadershipConfig" (
    "id" TEXT NOT NULL,
    "functionIds" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuardianLeadershipConfig_pkey" PRIMARY KEY ("id")
);`,
  // Mesma tabela da rota anterior (resultado travado de cada dia de checklist), caso ela não tenha sido aplicada: idempotente.
  `CREATE TABLE IF NOT EXISTS "ChecklistDayResult" (
    "collaboratorId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "collaboratorName" TEXT NOT NULL,
    "areaName" TEXT,
    "required" INTEGER NOT NULL,
    "done" INTEGER NOT NULL,
    "frozenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChecklistDayResult_pkey" PRIMARY KEY ("collaboratorId","dayKey")
);`,
  `CREATE INDEX IF NOT EXISTS "ChecklistDayResult_dayKey_idx" ON "ChecklistDayResult"("dayKey");`,
];

// Escopo fechado: cria GuardianGoldenRuleReview (conclusão das Regras de Ouro), GuardianLeadershipConfig (cargos de liderança) e, se faltar, ChecklistDayResult. Idempotente. Nada mais.
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
