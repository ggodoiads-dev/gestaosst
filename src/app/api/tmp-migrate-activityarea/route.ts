import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "da77817d3cae577a98d09e96e9df8e057c1d676108cf0eeab6c3d24fadd5a3cb";

// Migração fixa (mesmo SQL de prisma/migrations/20261016120000_add_activity_area), idempotente.
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "ActivityArea" (
    "activityId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    CONSTRAINT "ActivityArea_pkey" PRIMARY KEY ("activityId","areaId")
  )`,
  `CREATE INDEX IF NOT EXISTS "ActivityArea_areaId_idx" ON "ActivityArea"("areaId")`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ActivityArea_activityId_fkey') THEN
      ALTER TABLE "ActivityArea" ADD CONSTRAINT "ActivityArea_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ActivityArea_areaId_fkey') THEN
      ALTER TABLE "ActivityArea" ADD CONSTRAINT "ActivityArea_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$`,
];

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const given = Buffer.from(createHash("sha256").update(token).digest("hex"));
  const expected = Buffer.from(TOKEN_SHA256);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  for (const statement of STATEMENTS) await db.$executeRawUnsafe(statement);
  const rows = await db.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*)::bigint AS count FROM "ActivityArea"`);
  return NextResponse.json({ ok: true, table: "ActivityArea", rows: Number(rows[0].count) });
}
