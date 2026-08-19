import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

/**
 * Rota temporária de diagnóstico/reparo — protegida por token, criada pra aplicar a migration
 * de "Faz chamada?" (User.canRollCall + UserRollCallArea/UserRollCallTurno) direto no banco real
 * de produção (Vercel usa uma DATABASE_URL "Sensitive" que não pode ser lida de volta). Remover
 * depois de usar.
 */
const TOKEN = "b7e2f9a4c1d6e8b3f0a5c9d2e7b4f1a8c3d6e9b2f5a0c7d4e1b8f3a6c9d2e5b0";

const MIGRATION_STATEMENTS = [
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "canRollCall" BOOLEAN NOT NULL DEFAULT false`,
  `CREATE TABLE IF NOT EXISTS "UserRollCallArea" (
    "userId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    CONSTRAINT "UserRollCallArea_pkey" PRIMARY KEY ("userId","areaId")
  )`,
  `CREATE TABLE IF NOT EXISTS "UserRollCallTurno" (
    "userId" TEXT NOT NULL,
    "turnoId" TEXT NOT NULL,
    CONSTRAINT "UserRollCallTurno_pkey" PRIMARY KEY ("userId","turnoId")
  )`,
  `ALTER TABLE "UserRollCallArea" ADD CONSTRAINT "UserRollCallArea_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "UserRollCallArea" ADD CONSTRAINT "UserRollCallArea_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "UserRollCallTurno" ADD CONSTRAINT "UserRollCallTurno_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "UserRollCallTurno" ADD CONSTRAINT "UserRollCallTurno_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "Turno"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
];

async function diagnose() {
  const canRollCallExists = await db.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'canRollCall') as exists`,
  );
  const areaTableExists = await db.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'UserRollCallArea') as exists`,
  );
  const turnoTableExists = await db.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'UserRollCallTurno') as exists`,
  );

  return {
    canRollCallExists: canRollCallExists[0]?.exists ?? false,
    areaTableExists: areaTableExists[0]?.exists ?? false,
    turnoTableExists: turnoTableExists[0]?.exists ?? false,
  };
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const action = request.nextUrl.searchParams.get("action") === "fix" ? "fix" : "diagnose";

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
