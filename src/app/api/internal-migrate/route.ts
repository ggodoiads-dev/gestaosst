import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

/** Rota temporária — aplica a migration de ChecklistTemplateScope em produção. Remover depois. */
const TOKEN = "4b8e1f6a9c2d5e0b7f3a6c9d2e5b8f1a4c7d0e3b6f9a2c5d8e1b4f7a0c3d6e9b";

const STATEMENTS = [
  `DO $$ BEGIN
    CREATE TYPE "ChecklistTemplateScope" AS ENUM ('EQUIPAMENTO', 'AREA');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `ALTER TABLE "ChecklistTemplate" ADD COLUMN IF NOT EXISTS "scope" "ChecklistTemplateScope" NOT NULL DEFAULT 'EQUIPAMENTO'`,
  `ALTER TABLE "ChecklistTemplate" ADD COLUMN IF NOT EXISTS "areaId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "ChecklistTemplate_areaId_idx" ON "ChecklistTemplate"("areaId")`,
  `ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
];

async function diagnose() {
  const scopeExists = await db.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ChecklistTemplate' AND column_name = 'scope') as exists`,
  );
  const areaIdExists = await db.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ChecklistTemplate' AND column_name = 'areaId') as exists`,
  );
  return { scopeExists: scopeExists[0]?.exists ?? false, areaIdExists: areaIdExists[0]?.exists ?? false };
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const action = request.nextUrl.searchParams.get("action") === "fix" ? "fix" : "diagnose";

  if (action === "diagnose") {
    return NextResponse.json({ action, report: await diagnose() });
  }

  const results = [];
  for (const sql of STATEMENTS) {
    try {
      await db.$executeRawUnsafe(sql);
      results.push({ sql, ok: true });
    } catch (error) {
      results.push({ sql, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return NextResponse.json({ action, results, report: await diagnose() });
}
