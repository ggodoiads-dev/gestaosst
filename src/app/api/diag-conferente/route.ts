import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

const TOKEN = "7d3a9f2c6e0b8a4d1f7c3e9b6a2d8f5c0e4b7a1d9f3c6e8b2a5d0f7c4e9b1a6d";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const apply = request.nextUrl.searchParams.get("apply") === "1";

  const functions = await db.jobFunction.findMany({
    where: { name: { contains: "confer", mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      active: true,
      requiredChecklists: { select: { template: { select: { name: true } } } },
    },
  });

  const collaborators = await db.collaborator.findMany({
    where: {
      OR: [
        { functionId: { in: functions.map((f) => f.id) } },
        { cargo: { contains: "confer", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      cargo: true,
      active: true,
      checklistEnabled: true,
      requiresChecklist: true,
      function: { select: { id: true, name: true } },
    },
  });

  const toFix = collaborators.filter((c) => c.requiresChecklist).map((c) => c.id);

  if (apply && toFix.length > 0) {
    await db.collaborator.updateMany({ where: { id: { in: toFix } }, data: { requiresChecklist: false } });
  }

  return NextResponse.json({ ok: true, applied: apply, functions, collaborators, toFixCount: toFix.length });
}
