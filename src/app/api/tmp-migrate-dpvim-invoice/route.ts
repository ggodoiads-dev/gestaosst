import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "4725a836170f6363aeba9f9a9ef5a2710548e08aefafe9f9f70796face9a75f4";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "DpvimInvoiceAccess" (
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DpvimInvoiceAccess_pkey" PRIMARY KEY ("userId")
);`,
  `CREATE TABLE IF NOT EXISTS "DpvimInvoiceQty" (
    "dpvimId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "updatedById" TEXT NOT NULL,
    "updatedByName" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DpvimInvoiceQty_pkey" PRIMARY KEY ("dpvimId")
);`,
];

// Escopo fechado: cria as tabelas DpvimInvoiceAccess (quem ve a nota) e DpvimInvoiceQty (quantidade da nota de cada DPVIM), se ainda nao existirem. Idempotente. Nada mais.
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
