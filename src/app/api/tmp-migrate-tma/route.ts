import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "4511682be9a79b57be96171473dca3f7eb311c207122b12228a397719df450f7";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "TmaImport" (
    "id" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "rows" INTEGER NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedById" TEXT NOT NULL,
    CONSTRAINT "TmaImport_pkey" PRIMARY KEY ("id")
);`,
  `CREATE TABLE IF NOT EXISTS "TmaTruck" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "gradeDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "presentation" TEXT,
    "destino" TEXT,
    "tipoCarro" TEXT,
    "pedido" TEXT,
    "placas" TEXT,
    "motorista" TEXT,
    "transportadora" TEXT,
    "conferente" TEXT,
    "turno" TEXT,
    "checklist" TEXT,
    "agendamento" TIMESTAMP(3),
    "apresentacao" TIMESTAMP(3),
    "entradaAtendimento" TIMESTAMP(3),
    "entradaBaia" TIMESTAMP(3),
    "inicioCarregamento" TIMESTAMP(3),
    "fimCarregamento" TIMESTAMP(3),
    "fimAmarracao" TIMESTAMP(3),
    "liberacao" TIMESTAMP(3),
    "tmaMin" DOUBLE PRECISION,
    "atendimentoMin" DOUBLE PRECISION,
    "patioMin" DOUBLE PRECISION,
    "esperaMin" DOUBLE PRECISION,
    "tmcMin" DOUBLE PRECISION,
    "amarracaoMin" DOUBLE PRECISION,
    "liberacaoMin" DOUBLE PRECISION,
    CONSTRAINT "TmaTruck_pkey" PRIMARY KEY ("id")
);`,
  `CREATE INDEX IF NOT EXISTS "TmaTruck_periodKey_idx" ON "TmaTruck"("periodKey");`,
  `ALTER TABLE "TmaImport" ADD CONSTRAINT "TmaImport_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`,
  `ALTER TABLE "TmaTruck" ADD CONSTRAINT "TmaTruck_importId_fkey" FOREIGN KEY ("importId") REFERENCES "TmaImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  // O IC de TMA foi semeado com a hora lida como minutos (3:00 virou 3 min): corrige para 180 min (meta) e 229 min (3h49, acumulado de set).
  `UPDATE "CascadeNode" SET "target" = 180 WHERE "seedKey" = 'ic:tma' AND "target" = 3`,
  `UPDATE "CascadeValue" SET "ytd" = 229 WHERE "ytd" BETWEEN 3.8 AND 3.85 AND "nodeId" IN (SELECT "id" FROM "CascadeNode" WHERE "seedKey" = 'ic:tma')`,
];

// Escopo fechado: cria as tabelas do TMA (TmaImport e TmaTruck), se ainda não existirem, e corrige a meta/resultado do IC de TMA
// no cascateamento (se ele já tiver sido carregado). Idempotente. Nada mais.
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
      results.push(error instanceof Error && /already exists/i.test(error.message) ? "já existia" : "erro: " + String(error));
    }
  }
  return NextResponse.json({ ok: true, statements: results });
}
