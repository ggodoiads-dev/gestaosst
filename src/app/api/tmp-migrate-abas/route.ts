import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "93b8034a2ae744fa39c8941f1ca89965b7f18d10ed15e316a847fb4cec427c9a";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "UserNavAccess" (
    "userId" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    CONSTRAINT "UserNavAccess_pkey" PRIMARY KEY ("userId","href")
);`,
  `CREATE INDEX IF NOT EXISTS "UserNavAccess_userId_idx" ON "UserNavAccess"("userId");`,
];

// Escopo fechado: cria a tabela UserNavAccess (abas liberadas por usuário restrito), se ainda não existir. Idempotente. Nada mais.
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
