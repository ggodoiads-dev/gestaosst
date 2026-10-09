import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "42ad30658d0906597b89995e725f46ddcb2213abd518c6452c5f17f5e12eec9c";

// Migração fixa (mesmo SQL de prisma/migrations/20261009180000_add_absence_interview), idempotente.
const STATEMENTS = [
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AbsenceInterviewStatus') THEN
      CREATE TYPE "AbsenceInterviewStatus" AS ENUM ('SOLICITADA', 'RESPONDIDA', 'CONCLUIDA');
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AbsenceClassification') THEN
      CREATE TYPE "AbsenceClassification" AS ENUM ('JUSTIFICADA', 'NAO_JUSTIFICADA', 'PREVISTA_LEI');
    END IF;
  END $$`,
  `CREATE TABLE IF NOT EXISTS "AbsenceInterview" (
    "id" TEXT NOT NULL,
    "scheduleDayNoteId" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "status" "AbsenceInterviewStatus" NOT NULL DEFAULT 'SOLICITADA',
    "answers" JSONB,
    "filledByHr" BOOLEAN NOT NULL DEFAULT false,
    "answeredAt" TIMESTAMP(3),
    "answeredById" TEXT,
    "classification" "AbsenceClassification",
    "actionTaken" TEXT,
    "evaluation" JSONB,
    "concludedAt" TIMESTAMP(3),
    "concludedById" TEXT,
    "requestedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AbsenceInterview_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "AbsenceInterview_scheduleDayNoteId_key" ON "AbsenceInterview"("scheduleDayNoteId")`,
  `CREATE INDEX IF NOT EXISTS "AbsenceInterview_collaboratorId_idx" ON "AbsenceInterview"("collaboratorId")`,
  `CREATE INDEX IF NOT EXISTS "AbsenceInterview_status_idx" ON "AbsenceInterview"("status")`,
  ...[
    ["scheduleDayNoteId", `"ScheduleDayNote"("id") ON DELETE CASCADE ON UPDATE CASCADE`],
    ["collaboratorId", `"Collaborator"("id") ON DELETE RESTRICT ON UPDATE CASCADE`],
    ["requestedById", `"User"("id") ON DELETE RESTRICT ON UPDATE CASCADE`],
    ["answeredById", `"User"("id") ON DELETE SET NULL ON UPDATE CASCADE`],
    ["concludedById", `"User"("id") ON DELETE SET NULL ON UPDATE CASCADE`],
  ].map(
    ([column, target]) => `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AbsenceInterview_${column}_fkey') THEN
      ALTER TABLE "AbsenceInterview" ADD CONSTRAINT "AbsenceInterview_${column}_fkey" FOREIGN KEY ("${column}") REFERENCES ${target};
    END IF;
  END $$`,
  ),
];

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const given = Buffer.from(createHash("sha256").update(token).digest("hex"));
  const expected = Buffer.from(TOKEN_SHA256);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  for (const statement of STATEMENTS) await db.$executeRawUnsafe(statement);

  const rows = await db.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*)::bigint AS count FROM "AbsenceInterview"`);
  return NextResponse.json({ ok: true, table: "AbsenceInterview", rows: Number(rows[0].count) });
}
