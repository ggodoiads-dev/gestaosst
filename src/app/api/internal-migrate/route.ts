import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

/** Rota temporária — adiciona CANCELADA ao enum AccidentStatus em produção. Remover depois. */
const TOKEN = "3a7e9c1f5b8d2a6e0c4f9b3d7a1e5c8f2b6d0a4e9c3f7b1d5a8e2c6f0b4d9a3e";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const action = request.nextUrl.searchParams.get("action") === "fix" ? "fix" : "diagnose";

  const check = async () => {
    const exists = await db.$queryRawUnsafe<{ exists: boolean }[]>(
      `SELECT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'AccidentStatus' AND e.enumlabel = 'CANCELADA') as exists`,
    );
    return exists[0]?.exists ?? false;
  };

  if (action === "diagnose") {
    return NextResponse.json({ action, cancelaExists: await check() });
  }

  try {
    await db.$executeRawUnsafe(`ALTER TYPE "AccidentStatus" ADD VALUE IF NOT EXISTS 'CANCELADA'`);
    return NextResponse.json({ action, ok: true, cancelaExists: await check() });
  } catch (error) {
    return NextResponse.json({ action, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}
