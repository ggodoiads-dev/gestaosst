import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

const TOKEN = "7d3a9f2c6e0b8a4d1f7c3e9b6a2d8f5c0e4b7a1d9f3c6e8b2a5d0f7c4e9b1a6d";
const AREA_TEMPLATE_NAMES = ["Checklist de Amarração", "Checklist de Reforma de Bulk", "Checklist de Reforma de Paletes"];

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const apply = request.nextUrl.searchParams.get("apply") === "1";

  const templates = await db.checklistTemplate.findMany({
    where: { name: { in: AREA_TEMPLATE_NAMES } },
    include: { _count: { select: { assignments: { where: { active: true } } } } },
    orderBy: { name: "asc" },
  });

  const byName = new Map<string, typeof templates>();
  for (const t of templates) {
    (byName.get(t.name) ?? byName.set(t.name, []).get(t.name)!).push(t);
  }

  const toArchive: { id: string; name: string; activeAssignments: number }[] = [];
  const keep: { id: string; name: string; activeAssignments: number }[] = [];
  for (const [, group] of byName) {
    if (group.length <= 1) {
      for (const t of group) keep.push({ id: t.id, name: t.name, activeAssignments: t._count.assignments });
      continue;
    }
    const sorted = [...group].sort((a, b) => b._count.assignments - a._count.assignments);
    keep.push({ id: sorted[0]!.id, name: sorted[0]!.name, activeAssignments: sorted[0]!._count.assignments });
    for (const t of sorted.slice(1)) {
      toArchive.push({ id: t.id, name: t.name, activeAssignments: t._count.assignments });
    }
  }

  if (!apply) {
    return NextResponse.json({ preview: true, keep, toArchive, note: "chame de novo com &apply=1 pra arquivar os orfaos (status=ARQUIVADO)" });
  }

  const withRealAssignments = toArchive.filter((t) => t.activeAssignments > 0);
  if (withRealAssignments.length > 0) {
    return NextResponse.json({ applied: false, reason: "algum candidato a arquivar tem equipamentos ativos vinculados, abortado por seguranca", withRealAssignments });
  }

  const result = await db.checklistTemplate.updateMany({
    where: { id: { in: toArchive.map((t) => t.id) } },
    data: { status: "ARQUIVADO" },
  });

  return NextResponse.json({ applied: true, archivedCount: result.count, archived: toArchive });
}
