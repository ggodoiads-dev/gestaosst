import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "1512bcd298a516157403bde2edadb57a859657df469046bd0656ed05cebede45";

const STATEMENTS = [
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

// Escopo fechado: cria a tabela ChecklistDayResult (resultado travado de cada dia de checklist) e o índice, se ainda não existir. Idempotente. Nada mais.
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
