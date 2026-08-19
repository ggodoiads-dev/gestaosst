import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

const TOKEN = "3d7a9c2f5e8b1d4a6c9f2e5b8d1a4c7f0e3b6d9a2c5f8e1b4d7a0c3f6e9b2d5a";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [areas, equipmentTypes] = await Promise.all([
    db.area.findMany({ where: { name: { contains: "amarr", mode: "insensitive" } } }),
    db.equipmentType.findMany({ where: { name: { contains: "amarr", mode: "insensitive" } } }),
  ]);

  const areaIds = areas.map((a) => a.id);
  const typeIds = equipmentTypes.map((t) => t.id);

  const equipmentByArea =
    areaIds.length > 0
      ? await db.equipment.findMany({
          where: { areaId: { in: areaIds }, active: true },
          select: { id: true, code: true, name: true, typeId: true, type: { select: { name: true } }, area: { select: { name: true } } },
        })
      : [];

  const equipmentByType =
    typeIds.length > 0
      ? await db.equipment.findMany({
          where: { typeId: { in: typeIds }, active: true },
          select: { id: true, code: true, name: true, typeId: true, type: { select: { name: true } }, area: { select: { name: true } } },
        })
      : [];

  return NextResponse.json({ areas, equipmentTypes, equipmentByArea, equipmentByType });
}
