import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

/** Rota temporária de diagnóstico read-only — checar se os acidentes em produção são só os 230
 * importados errado (sem filtro de empresa) ou se já existia algo antes. Remover depois de usar. */
const TOKEN = "8b4e1c9a6f3d0b7e2c5a8f1d4b9e6c3a0f7d2b5e8c1a4f9d6b3e0c7a5f2d8b1e";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const total = await db.accident.count();
  const byReportedBy = await db.accident.groupBy({ by: ["reportedById"], _count: true });
  const earliest = await db.accident.findFirst({ orderBy: { reportedAt: "asc" }, select: { code: true, reportedAt: true, description: true } });
  const latest = await db.accident.findFirst({ orderBy: { reportedAt: "desc" }, select: { code: true, reportedAt: true, description: true } });

  return NextResponse.json({ total, byReportedBy, earliest, latest });
}
