import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

/**
 * Rota temporária de diagnóstico (read-only) — investigar por que a tela de Realizar Checklist
 * não mostra itens em produção. Remover depois de usar.
 */
const TOKEN = "8f3a1c9d2e6b47f0a5d8c1e3b9f6a2d7c4e8b1f5a3d9c6e2b7f4a1d8c5e9b3f0";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [equipmentActive, templates, versionsByStatus, assignmentsActive, equipmentWithAssignmentButNoVersion] =
    await Promise.all([
      db.equipment.count({ where: { active: true } }),
      db.checklistTemplate.findMany({ select: { id: true, name: true, status: true } }),
      db.checklistVersion.groupBy({ by: ["status"], _count: true }),
      db.equipmentChecklistAssignment.count({ where: { active: true } }),
      db.equipment.findMany({
        where: { active: true, assignments: { some: { active: true } } },
        select: {
          id: true,
          code: true,
          name: true,
          area: { select: { name: true } },
          assignments: {
            where: { active: true },
            select: {
              template: {
                select: { id: true, name: true, status: true, versions: { select: { status: true } } },
              },
            },
          },
        },
      }),
    ]);

  return NextResponse.json({
    equipmentActive,
    templates,
    versionsByStatus,
    assignmentsActive,
    equipmentWithAssignmentButNoVersion,
  });
}
