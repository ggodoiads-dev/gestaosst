import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "a392ea93644cbf699e3d5f58bc07ba9f474467f29f66de2131c2562cac312cc8";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "AccidentInvolvedPerson" (
    "id" TEXT NOT NULL,
    "accidentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sap" TEXT,
    "cargo" TEXT,
    "collaboratorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccidentInvolvedPerson_pkey" PRIMARY KEY ("id")
);`,
  `CREATE INDEX IF NOT EXISTS "AccidentInvolvedPerson_accidentId_idx" ON "AccidentInvolvedPerson"("accidentId");`,
  `ALTER TABLE "AccidentInvolvedPerson" ADD CONSTRAINT "AccidentInvolvedPerson_accidentId_fkey" FOREIGN KEY ("accidentId") REFERENCES "Accident"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
];

// Escopo fechado: cria a tabela AccidentInvolvedPerson (envolvidos do acidente com SAP e cargo), se ainda não existir. Idempotente. Nada mais.
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
