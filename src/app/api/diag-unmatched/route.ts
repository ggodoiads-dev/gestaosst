import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

const TOKEN = "7d3a9f2c6e0b8a4d1f7c3e9b6a2d8f5c0e4b7a1d9f3c6e8b2a5d0f7c4e9b1a6d";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const groups = await db.timeClockRecord.groupBy({
    by: ["pis"],
    where: { collaboratorId: null },
    _count: { _all: true },
  });
  const ignored = await db.ignoredTimeClockPis.findMany({ select: { pis: true } });
  const ignoredSet = new Set(ignored.map((i) => i.pis));

  return NextResponse.json({
    unmatched: groups.filter((g) => !ignoredSet.has(g.pis)).map((g) => ({ pis: g.pis, count: g._count._all })),
  });
}
