import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN = "7d3a9f2c6e0b8a4d1f7c3e9b6a2d8f5c0e4b7a1d9f3c6e8b2a5d0f7c4e9b1a6d";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const blocked = await db.equipment.findMany({
    where: { status: "BLOQUEADO" },
    select: { id: true, code: true, name: true, areaId: true, area: { select: { name: true } } },
  });
  return NextResponse.json({ count: blocked.length, blocked });
}
