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
    include: { versions: { include: { questions: { include: { rules: true } } } } },
  });

  const toFix: { ruleId: string; templateId: string; templateName: string; versionStatus: string; questionTitle: string }[] = [];
  for (const t of templates) {
    for (const v of t.versions) {
      for (const q of v.questions) {
        for (const r of q.rules) {
          if (r.triggerValue === "NAO_CONFORME" && (!r.blocksEquipment || r.severity !== "CRITICA")) {
            toFix.push({ ruleId: r.id, templateId: t.id, templateName: t.name, versionStatus: v.status, questionTitle: q.title });
          }
        }
      }
    }
  }

  if (!apply) {
    return NextResponse.json({
      preview: true,
      templatesFound: templates.map((t) => ({ id: t.id, name: t.name, versionCount: t.versions.length })),
      rulesToFix: toFix,
      note: "chame de novo com &apply=1 pra corrigir (isCritical=true, blocksEquipment=true, severity=CRITICA)",
    });
  }

  const results = [];
  for (const fix of toFix) {
    const updated = await db.questionRule.update({
      where: { id: fix.ruleId },
      data: { isCritical: true, blocksEquipment: true, severity: "CRITICA" },
    });
    results.push(updated);
  }

  return NextResponse.json({ applied: true, fixedCount: results.length });
}
