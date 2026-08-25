import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

const TOKEN = "7d3a9f2c6e0b8a4d1f7c3e9b6a2d8f5c0e4b7a1d9f3c6e8b2a5d0f7c4e9b1a6d";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const collaborators = await db.collaborator.findMany({
    where: { name: { contains: "Quadros", mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      cargo: true,
      functionId: true,
      areaId: true,
      area: { select: { name: true } },
      userId: true,
      checklistEnabled: true,
      active: true,
      function: {
        select: {
          id: true,
          name: true,
          requiredChecklists: { select: { template: { select: { id: true, name: true, status: true } } } },
        },
      },
    },
  });

  const collaboratorsAccent = await db.collaborator.findMany({
    where: { name: { contains: "vio", mode: "insensitive" }, cargo: { contains: "marra", mode: "insensitive" } },
    select: { id: true, name: true, cargo: true, functionId: true },
  });

  const amarracaoFunctions = await db.jobFunction.findMany({
    where: { name: { contains: "amarra", mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      active: true,
      requiredChecklists: { select: { template: { select: { id: true, name: true, status: true } } } },
      collaborators: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ ok: true, collaborators, collaboratorsAccent, amarracaoFunctions });
}
