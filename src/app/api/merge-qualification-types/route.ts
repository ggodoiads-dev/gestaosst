import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { addMonths } from "date-fns";

const TOKEN = "7d3a9f2c6e0b8a4d1f7c3e9b6a2d8f5c0e4b7a1d9f3c6e8b2a5d0f7c4e9b1a6d";

const MERGE_PAIRS = [
  { duplicateName: "Operador de empilhadeira", canonicalName: "NR-11 — Transporte e Movimentação de Materiais" },
  { duplicateName: "Operador de paleteira elétrica", canonicalName: "NR-11 — Transporte e Movimentação de Materiais" },
  { duplicateName: "Trabalho em altura", canonicalName: "NR-35 — Trabalho em Altura" },
  { duplicateName: "Treinamento de integração", canonicalName: "Integração" },
];

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const apply = request.nextUrl.searchParams.get("apply") === "1";

  const results = [];
  for (const pair of MERGE_PAIRS) {
    const duplicate = await db.qualificationType.findFirst({ where: { name: pair.duplicateName } });
    const canonical = await db.qualificationType.findFirst({ where: { name: pair.canonicalName } });
    if (!duplicate || !canonical) {
      results.push({ ...pair, error: `não encontrado: ${!duplicate ? "duplicado" : "canônico"}` });
      continue;
    }
    const records = await db.qualificationRecord.findMany({
      where: { qualificationTypeId: duplicate.id },
      include: { collaborator: { select: { name: true } } },
    });
    results.push({
      duplicateId: duplicate.id,
      duplicateName: duplicate.name,
      canonicalId: canonical.id,
      canonicalName: canonical.name,
      recordCount: records.length,
      collaborators: records.map((r) => r.collaborator.name),
    });
  }

  if (!apply) {
    return NextResponse.json({ preview: true, results, note: "chame de novo com &apply=1 pra mesclar de verdade" });
  }

  const applied = [];
  for (const r of results) {
    if (!r.duplicateId || !r.canonicalId) continue;
    await db.$transaction(async (tx) => {
      const canonical = await tx.qualificationType.findUniqueOrThrow({ where: { id: r.canonicalId } });
      const records = await tx.qualificationRecord.findMany({ where: { qualificationTypeId: r.duplicateId } });
      for (const rec of records) {
        const expiresAt = canonical.validityMonths ? addMonths(rec.completedDate, canonical.validityMonths) : null;
        await tx.qualificationRecord.update({ where: { id: rec.id }, data: { qualificationTypeId: r.canonicalId, expiresAt } });
      }
      await tx.qualificationType.update({
        where: { id: r.canonicalId },
        data: { aliases: { push: r.duplicateName } },
      });
    });
    applied.push({ duplicateName: r.duplicateName, canonicalName: r.canonicalName, movedRecords: r.recordCount });
  }

  return NextResponse.json({ applied: true, results: applied });
}
