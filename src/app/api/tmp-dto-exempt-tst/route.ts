import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "b4ce844b7ff59448340db26919b8b7993268842790d008003bf5164902aaf7cd";

// Escopo fechado: marca como isentas de DTO as funções de Técnico de Segurança (TST). Nada mais.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const given = Buffer.from(createHash("sha256").update(token).digest("hex"));
  const expected = Buffer.from(TOKEN_SHA256);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rows = await db.$queryRawUnsafe<{ name: string }[]>(
    `UPDATE "JobFunction" SET "dtoExempt" = true WHERE "dtoExempt" = false AND ("name" ILIKE '%TÉCNICO DE SEGURAN%' OR "name" ILIKE '%TECNICO DE SEGURAN%' OR "name" ILIKE 'TST') RETURNING "name"`,
  );
  const exempt = await db.$queryRawUnsafe<{ name: string }[]>(`SELECT "name" FROM "JobFunction" WHERE "dtoExempt" = true ORDER BY "name"`);
  return NextResponse.json({ ok: true, marked: rows.map((r) => r.name), exempt: exempt.map((r) => r.name) });
}
