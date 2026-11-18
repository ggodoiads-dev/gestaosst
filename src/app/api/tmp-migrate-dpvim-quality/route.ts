import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "45dce92fef4ea4e95acb1b6e1604fc23d1a48299090f05b78979f517b9bd1527";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "DpvimSessionQuality" (
    "sessionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "good" INTEGER NOT NULL DEFAULT 0,
    "transfer" INTEGER NOT NULL DEFAULT 0,
    "discard" INTEGER NOT NULL DEFAULT 0,
    "dpvimId" TEXT NOT NULL,
    CONSTRAINT "DpvimSessionQuality_pkey" PRIMARY KEY ("sessionId", "kind")
);`,
  `CREATE INDEX IF NOT EXISTS "DpvimSessionQuality_dpvimId_idx" ON "DpvimSessionQuality"("dpvimId");`,
];

// Escopo fechado: cria a tabela DpvimSessionQuality (bons, transferencia e descarte por produto em cada atividade da DPVIM) com o indice, se ainda nao existir. Idempotente. Nada mais.
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
