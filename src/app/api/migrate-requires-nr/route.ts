import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

const TOKEN = "7d3a9f2c6e0b8a4d1f7c3e9b6a2d8f5c0e4b7a1d9f3c6e8b2a5d0f7c4e9b1a6d";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await db.$executeRawUnsafe(`ALTER TABLE "JobFunction" ADD COLUMN IF NOT EXISTS "requiresNr" BOOLEAN NOT NULL DEFAULT true;`);

  const jobFunctions = await db.jobFunction.findMany({ select: { name: true, requiresNr: true } });
  return NextResponse.json({ ok: true, jobFunctions });
}
