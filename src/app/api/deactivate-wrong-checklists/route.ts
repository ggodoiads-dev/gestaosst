import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

/** Rota temporária — desativa os 3 templates de checklist criados errado (por equipamento
 * individual em vez de por área). Não apaga nada, só tira da tela de Realizar Checklist. */
const TOKEN = "2f8b5d1a9c4e7f0b3d6a9c2e5f8b1d4a7c0e3f6b9d2a5c8e1f4b7d0a3c6e9f2b";

const TEMPLATE_NAMES = ["Checklist de Amarração", "Checklist de Reforma de Bulk", "Checklist de Reforma de Paletes"];

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const results = [];
  for (const name of TEMPLATE_NAMES) {
    const template = await db.checklistTemplate.findFirst({ where: { name } });
    if (!template) {
      results.push({ name, found: false });
      continue;
    }
    await db.$transaction([
      db.equipmentChecklistAssignment.updateMany({ where: { templateId: template.id }, data: { active: false } }),
      db.checklistTemplate.update({ where: { id: template.id }, data: { status: "ARQUIVADO" } }),
    ]);
    results.push({ name, found: true, templateId: template.id });
  }

  return NextResponse.json({ results });
}
