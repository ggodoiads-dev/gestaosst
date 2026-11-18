import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "c616a8e81afe6bb2e7a510664cacd42b21cb25bc0475ee167d2813e502c0f376";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "GuardianGoldenRuleMdt" (
    "guardianId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    CONSTRAINT "GuardianGoldenRuleMdt_pkey" PRIMARY KEY ("guardianId")
);`,
];

// Escopo fechado: cria a tabela GuardianGoldenRuleMdt (qual medida disciplinar foi aplicada num relato de Regra de Ouro), se ainda nao existir. Idempotente. Nada mais.
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
