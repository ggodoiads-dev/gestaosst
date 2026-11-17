import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "c1c6a4ce9206b271232470edebfa0709b8b1e80be42a8abc483043972d1fc3a3";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "DisciplineRecord" (
    "id" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DisciplineRecord_pkey" PRIMARY KEY ("id")
);`,
  `CREATE INDEX IF NOT EXISTS "DisciplineRecord_collaboratorId_date_idx" ON "DisciplineRecord"("collaboratorId", "date");`,
  `CREATE INDEX IF NOT EXISTS "DisciplineRecord_date_idx" ON "DisciplineRecord"("date");`,
  `CREATE TABLE IF NOT EXISTS "DisciplineRecordFile" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedByName" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DisciplineRecordFile_pkey" PRIMARY KEY ("id")
);`,
  `CREATE INDEX IF NOT EXISTS "DisciplineRecordFile_recordId_idx" ON "DisciplineRecordFile"("recordId");`,
];

// Escopo fechado: cria DisciplineRecord e DisciplineRecordFile (advertencias registradas a mao e seus anexos) com os indices, se ainda nao existirem. Idempotente. Nada mais.
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
