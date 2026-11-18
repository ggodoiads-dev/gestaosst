import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "1f4fabaa3c8f59bd8854a810613991626a62dfce8f9502bebca9d872ba5d5901";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "DpvimLaunchAccess" (
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DpvimLaunchAccess_pkey" PRIMARY KEY ("userId")
);`,
];

// Escopo fechado: cria a tabela DpvimLaunchAccess (usuarios liberados para lancar DPVIM), se ainda nao existir. Idempotente. Nada mais.
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
