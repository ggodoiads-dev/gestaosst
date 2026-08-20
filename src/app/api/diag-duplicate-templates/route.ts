import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

const TOKEN = "7d3a9f2c6e0b8a4d1f7c3e9b6a2d8f5c0e4b7a1d9f3c6e8b2a5d0f7c4e9b1a6d";
const AREA_TEMPLATE_NAMES = ["Checklist de Amarração", "Checklist de Reforma de Bulk", "Checklist de Reforma de Paletes"];

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const templates = await db.checklistTemplate.findMany({
    where: { name: { in: AREA_TEMPLATE_NAMES } },
    include: {
      area: true,
      assignments: { where: { active: true }, include: { equipment: { select: { code: true, name: true, areaId: true } } } },
      versions: { select: { id: true, status: true, versionNumber: true } },
      _count: { select: { assignments: true } },
    },
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({
    templates: templates.map((t) => ({
      id: t.id,
      name: t.name,
      areaName: t.area?.name,
      createdAt: t.createdAt,
      versions: t.versions,
      activeAssignmentCount: t._count.assignments,
      assignments: t.assignments.map((a) => ({ equipmentCode: a.equipment.code, equipmentName: a.equipment.name })),
    })),
  });
}
