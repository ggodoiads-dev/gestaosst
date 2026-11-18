import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "72e54495917fac47df6b027c5dc147af9e39e5cf9b03714d6fe38900b4ec6089";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "UserChecklistGrant" (
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    CONSTRAINT "UserChecklistGrant_pkey" PRIMARY KEY ("userId", "templateId")
);`,
  `CREATE INDEX IF NOT EXISTS "UserChecklistGrant_userId_idx" ON "UserChecklistGrant"("userId");`,
];

// Escopo fechado: cria a tabela UserChecklistGrant (quais checklists cada usuario pode realizar alem dos da area/cargo) com o indice, se ainda nao existir. Idempotente. Nada mais.
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
