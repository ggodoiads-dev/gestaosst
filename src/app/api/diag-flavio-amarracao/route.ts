import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

const TOKEN = "7d3a9f2c6e0b8a4d1f7c3e9b6a2d8f5c0e4b7a1d9f3c6e8b2a5d0f7c4e9b1a6d";
const TEMPLATE_ID = "9c7fc461-d868-40d3-9158-04bcc4ff0c31";
const USER_ID = "d7b17bc5-8375-4da5-9e51-d52bdd059979";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const template = await db.checklistTemplate.findUnique({
    where: { id: TEMPLATE_ID },
    select: {
      id: true,
      name: true,
      scope: true,
      status: true,
      areaId: true,
      area: { select: { name: true } },
      equipmentTypeId: true,
      equipmentType: { select: { name: true } },
      versions: { select: { id: true, status: true, versionNumber: true } },
    },
  });

  const assignments = await db.equipmentChecklistAssignment.findMany({
    where: { templateId: TEMPLATE_ID },
    select: {
      active: true,
      equipment: { select: { id: true, code: true, name: true, active: true, areaId: true, area: { select: { name: true } } } },
    },
  });

  const user = await db.user.findUnique({
    where: { id: USER_ID },
    select: {
      id: true,
      name: true,
      active: true,
      role: {
        select: {
          key: true,
          name: true,
          rolePermissions: { select: { permission: { select: { key: true } } } },
        },
      },
      userAreas: { select: { area: { select: { id: true, name: true } } } },
    },
  });

  return NextResponse.json({ ok: true, template, assignments, user });
}
