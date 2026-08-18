import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

/**
 * Rota temporária de diagnóstico/reparo — protegida por token, criada só pra investigar e
 * corrigir uma divergência entre o schema local e o banco real de produção (Vercel usa uma
 * DATABASE_URL "Sensitive" que não pode ser lida de volta, então rodamos o SQL aqui dentro,
 * onde o runtime tem acesso à variável real). Remover depois de usar — não faz parte do produto.
 */
const TOKEN = "decd8cca4fceacb4a87f5ed83e9d6db83c752cf5486302b0";

const MIGRATION_STATEMENTS = [
  `ALTER TYPE "ScheduleDayNoteStatus" ADD VALUE IF NOT EXISTS 'BH_MAIS'`,
  `ALTER TABLE "ScheduleDayNote" ADD COLUMN IF NOT EXISTS "warningApplied" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "ScheduleDayNote" ADD COLUMN IF NOT EXISTS "absenceInterviewDone" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "Area" ADD COLUMN IF NOT EXISTS "qrToken" TEXT`,
  `UPDATE "Area" SET "qrToken" = gen_random_uuid()::text WHERE "qrToken" IS NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Area_qrToken_key" ON "Area"("qrToken")`,
  `CREATE TABLE IF NOT EXISTS "CollaboratorEquipment" (
    "id" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CollaboratorEquipment_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "CollaboratorEquipment_collaboratorId_equipmentId_key" ON "CollaboratorEquipment"("collaboratorId", "equipmentId")`,
  `ALTER TABLE "CollaboratorEquipment" ADD CONSTRAINT "CollaboratorEquipment_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
  `ALTER TABLE "CollaboratorEquipment" ADD CONSTRAINT "CollaboratorEquipment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
  `ALTER TABLE "CollaboratorEquipment" ADD CONSTRAINT "CollaboratorEquipment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
];

async function diagnose() {
  const areaQrTokenExists = await db.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Area' AND column_name = 'qrToken') as exists`,
  );
  const collaboratorEquipmentExists = await db.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CollaboratorEquipment') as exists`,
  );
  const warningAppliedExists = await db.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ScheduleDayNote' AND column_name = 'warningApplied') as exists`,
  );
  const bhMaisExists = await db.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'ScheduleDayNoteStatus' AND e.enumlabel = 'BH_MAIS') as exists`,
  );

  const userCount = await db.user.count();
  const collaboratorCount = await db.collaborator.count();
  const users = await db.user.findMany({ select: { email: true, active: true } });

  return {
    schema: {
      areaQrTokenExists: areaQrTokenExists[0]?.exists ?? false,
      collaboratorEquipmentExists: collaboratorEquipmentExists[0]?.exists ?? false,
      warningAppliedExists: warningAppliedExists[0]?.exists ?? false,
      bhMaisExists: bhMaisExists[0]?.exists ?? false,
    },
    data: { userCount, collaboratorCount, users },
  };
}

export async function POST(request: NextRequest) {
  const token = request.headers.get("x-migration-token");
  if (token !== TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body?.action === "fix" ? "fix" : "diagnose";

  if (action === "diagnose") {
    const report = await diagnose();
    return NextResponse.json({ action, report });
  }

  const results: { sql: string; ok: boolean; error?: string }[] = [];
  for (const sql of MIGRATION_STATEMENTS) {
    try {
      await db.$executeRawUnsafe(sql);
      results.push({ sql, ok: true });
    } catch (error) {
      results.push({ sql, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const report = await diagnose();
  return NextResponse.json({ action, results, report });
}
