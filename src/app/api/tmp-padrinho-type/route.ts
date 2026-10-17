import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { PADRINHO_TYPE_ALIASES, PADRINHO_TYPE_NAME } from "@/domain/qualification/padrinho";

const TOKEN_SHA256 = "4b364afaec742b87c665474e450cf5859f004a46db0e3f6d4c30eb58727d8eb5";

// Escopo fechado: cria (se ainda não existir) o tipo de qualificação "Padrinho" — categoria OUTRO, sem validade. Nada mais.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const given = Buffer.from(createHash("sha256").update(token).digest("hex"));
  const expected = Buffer.from(TOKEN_SHA256);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const existing = await db.qualificationType.findFirst({ where: { name: { contains: "padrinho", mode: "insensitive" } } });
  if (existing) return NextResponse.json({ ok: true, created: false, type: existing.name });

  const created = await db.qualificationType.create({
    data: { name: PADRINHO_TYPE_NAME, aliases: PADRINHO_TYPE_ALIASES, category: "OUTRO", validityMonths: null },
  });
  return NextResponse.json({ ok: true, created: true, type: created.name });
}
