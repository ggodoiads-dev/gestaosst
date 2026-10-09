import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "aa1248edb03d42cd06df245f7aad603d77ec29a76cd8c3c632c9dcfea135455f";

// Escopo fechado: cria a coluna "DtoAction"."cancelReason" (idempotente). Nada mais.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const given = Buffer.from(createHash("sha256").update(token).digest("hex"));
  const expected = Buffer.from(TOKEN_SHA256);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await db.$executeRawUnsafe(`ALTER TABLE "DtoAction" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT`);
  const rows = await db.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*)::bigint AS count FROM "DtoAction"`);
  return NextResponse.json({ ok: true, column: "cancelReason", rows: Number(rows[0].count) });
}
