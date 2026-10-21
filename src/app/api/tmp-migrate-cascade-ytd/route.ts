import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "77b8fdcefb0bd3e0560b1174ed176a12bf743a8363e59d3cf089adc73085046b";

const STATEMENTS = [
  `ALTER TABLE "CascadeValue" ADD COLUMN IF NOT EXISTS "ytd" DOUBLE PRECISION;`,
  `ALTER TABLE "CascadeValue" ALTER COLUMN "value" DROP NOT NULL;`,
  `UPDATE "CascadeValue" SET "ytd" = "value", "value" = NULL WHERE "source" = 'IMPORT' AND "ytd" IS NULL;`,
  `UPDATE "CascadeNode" SET "sigoKey" = 'dto.month.count' WHERE "seedKey" = 'ic:dto-dmpeople' AND "sigoKey" = 'dto.year.count';`,
];

// Escopo fechado: acrescenta a coluna ytd (acumulado do ano) ao cascateamento, move os valores importados da planilha pra
// ela e aponta o IC de DTO pro resultado do mês. Idempotente. Nada mais.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const given = Buffer.from(createHash("sha256").update(token).digest("hex"));
  const expected = Buffer.from(TOKEN_SHA256);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const results: string[] = [];
  for (const sql of STATEMENTS) {
    try {
      const affected = await db.$executeRawUnsafe(sql);
      results.push(`ok (${affected})`);
    } catch (error) {
      results.push("erro: " + String(error));
    }
  }
  return NextResponse.json({ ok: true, statements: results });
}
