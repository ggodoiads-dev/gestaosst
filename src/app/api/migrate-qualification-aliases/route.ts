import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

const TOKEN = "7d3a9f2c6e0b8a4d1f7c3e9b6a2d8f5c0e4b7a1d9f3c6e8b2a5d0f7c4e9b1a6d";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await db.$executeRawUnsafe(`ALTER TABLE "QualificationType" ADD COLUMN IF NOT EXISTS "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];`);

  const types = await db.qualificationType.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ ok: true, types: types.map((t) => ({ id: t.id, name: t.name, category: t.category, active: t.active })) });
}
