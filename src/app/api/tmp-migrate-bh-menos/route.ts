import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "79cd8b340f87208e8c492d1dbfabbe0c176c77752cfc3ffe877f71a98ab8cd6d";

// Escopo fechado: só acrescenta o valor BH_MENOS ao enum ScheduleDayNoteStatus (idempotente). Nada mais.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const given = Buffer.from(createHash("sha256").update(token).digest("hex"));
  const expected = Buffer.from(TOKEN_SHA256);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await db.$executeRawUnsafe(`ALTER TYPE "ScheduleDayNoteStatus" ADD VALUE IF NOT EXISTS 'BH_MENOS'`);
  return NextResponse.json({ ok: true, value: "BH_MENOS" });
}
