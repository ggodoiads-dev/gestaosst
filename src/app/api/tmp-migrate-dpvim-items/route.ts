import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "29aee93e5badf4b362ae7bf854ac553387015f0afeec83c3d10db777532b6ee3";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "DpvimItem" (
    "id" TEXT NOT NULL,
    "dpvimId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "expectedQty" INTEGER NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "DpvimItem_pkey" PRIMARY KEY ("id")
);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "DpvimItem_dpvimId_kind_key" ON "DpvimItem"("dpvimId", "kind");`,
  `CREATE INDEX IF NOT EXISTS "DpvimItem_dpvimId_idx" ON "DpvimItem"("dpvimId");`,
  `CREATE TABLE IF NOT EXISTS "DpvimSessionItem" (
    "sessionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "dpvimId" TEXT NOT NULL,
    CONSTRAINT "DpvimSessionItem_pkey" PRIMARY KEY ("sessionId", "kind")
);`,
  `CREATE INDEX IF NOT EXISTS "DpvimSessionItem_dpvimId_idx" ON "DpvimSessionItem"("dpvimId");`,
  `CREATE TABLE IF NOT EXISTS "DpvimItemInvoice" (
    "dpvimId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "updatedById" TEXT NOT NULL,
    "updatedByName" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DpvimItemInvoice_pkey" PRIMARY KEY ("dpvimId", "kind")
);`,
];

// Escopo fechado: cria as tabelas DpvimItem (produtos da DPVIM), DpvimSessionItem (contagem dos ajudantes por produto) e DpvimItemInvoice (nota por produto), com os indices, se ainda nao existirem. Idempotente. Nada mais.
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
