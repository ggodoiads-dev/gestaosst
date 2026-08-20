import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

/** Rota temporária — cria a tabela IgnoredTimeClockPis em produção. Remover depois. */
const TOKEN = "9f2b6d3a8e5c1f7b0a4d9c6e2f8b5d1a7c3e0f6b9d2a5c8e1f4b7d0a3c6e9f2b";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const action = request.nextUrl.searchParams.get("action") === "fix" ? "fix" : "diagnose";

  const check = async () => {
    const exists = await db.$queryRawUnsafe<{ exists: boolean }[]>(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'IgnoredTimeClockPis') as exists`,
    );
    return exists[0]?.exists ?? false;
  };

  if (action === "diagnose") {
    return NextResponse.json({ action, tableExists: await check() });
  }

  const statements = [
    `CREATE TABLE IF NOT EXISTS "IgnoredTimeClockPis" (
      "pis" TEXT NOT NULL,
      "ignoredById" TEXT NOT NULL,
      "ignoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "IgnoredTimeClockPis_pkey" PRIMARY KEY ("pis")
    )`,
    `ALTER TABLE "IgnoredTimeClockPis" ADD CONSTRAINT "IgnoredTimeClockPis_ignoredById_fkey" FOREIGN KEY ("ignoredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
  ];

  const results = [];
  for (const sql of statements) {
    try {
      await db.$executeRawUnsafe(sql);
      results.push({ sql, ok: true });
    } catch (error) {
      results.push({ sql, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return NextResponse.json({ action, results, tableExists: await check() });
}
