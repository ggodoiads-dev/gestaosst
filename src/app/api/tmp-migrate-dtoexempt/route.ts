import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "1e5b4749e5ba71239e09963fa389a6abfb05da60291328322820f648ac93d40d";

// Escopo fechado: (1) cria a coluna "JobFunction"."dtoExempt" (idempotente, padrão false); (2) marca como isentas de DTO as
// funções de ADM/liderança pelo nome (só as que ainda estão false) e devolve quais foram marcadas pra conferência. Nada mais.
const KEYWORDS = ["SUPERVIS", "COORDENA", "GERENT", "ANALISTA", "ASSISTENTE", "ADMINISTRAT", "LIDER", "LÍDER", "DIRETOR", "ESTAGI"];

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const given = Buffer.from(createHash("sha256").update(token).digest("hex"));
  const expected = Buffer.from(TOKEN_SHA256);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await db.$executeRawUnsafe(`ALTER TABLE "JobFunction" ADD COLUMN IF NOT EXISTS "dtoExempt" BOOLEAN NOT NULL DEFAULT false`);

  const marked: string[] = [];
  for (const keyword of KEYWORDS) {
    const rows = await db.$queryRawUnsafe<{ name: string }[]>(
      `UPDATE "JobFunction" SET "dtoExempt" = true WHERE "dtoExempt" = false AND "name" ILIKE $1 RETURNING "name"`,
      `%${keyword}%`,
    );
    marked.push(...rows.map((r) => r.name));
  }
  const all = await db.$queryRawUnsafe<{ name: string; dtoExempt: boolean }[]>(`SELECT "name", "dtoExempt" FROM "JobFunction" ORDER BY "name"`);
  return NextResponse.json({
    ok: true,
    marked: marked.sort(),
    exempt: all.filter((f) => f.dtoExempt).map((f) => f.name),
    notExempt: all.filter((f) => !f.dtoExempt).map((f) => f.name),
  });
}
