import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

const TOKEN = "7d3a9f2c6e0b8a4d1f7c3e9b6a2d8f5c0e4b7a1d9f3c6e8b2a5d0f7c4e9b1a6d";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "JobFunctionRequiredChecklist" (
      "id" TEXT NOT NULL,
      "functionId" TEXT NOT NULL,
      "templateId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "JobFunctionRequiredChecklist_pkey" PRIMARY KEY ("id")
    );
  `);
  await db.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "JobFunctionRequiredChecklist_functionId_templateId_key"
      ON "JobFunctionRequiredChecklist"("functionId", "templateId");
  `);
  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "JobFunctionRequiredChecklist_templateId_idx"
      ON "JobFunctionRequiredChecklist"("templateId");
  `);
  await db.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "JobFunctionRequiredChecklist" ADD CONSTRAINT "JobFunctionRequiredChecklist_functionId_fkey"
        FOREIGN KEY ("functionId") REFERENCES "JobFunction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await db.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "JobFunctionRequiredChecklist" ADD CONSTRAINT "JobFunctionRequiredChecklist_templateId_fkey"
        FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  const count = await db.jobFunctionRequiredChecklist.count();
  return NextResponse.json({ ok: true, tableRowCount: count });
}
