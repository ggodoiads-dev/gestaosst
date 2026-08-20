import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

const TOKEN = "7d3a9f2c6e0b8a4d1f7c3e9b6a2d8f5c0e4b7a1d9f3c6e8b2a5d0f7c4e9b1a6d";
const APP_TIMEZONE = "America/Sao_Paulo";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Todos os codigos nao vinculados (sem colaborador), com todas as batidas.
  const unmatchedRecords = await db.timeClockRecord.findMany({
    where: { collaboratorId: null },
    orderBy: [{ pis: "asc" }, { timestamp: "asc" }],
  });
  const ignored = await db.ignoredTimeClockPis.findMany({ select: { pis: true } });
  const ignoredSet = new Set(ignored.map((i) => i.pis));

  const byPis = new Map<string, typeof unmatchedRecords>();
  for (const r of unmatchedRecords) {
    if (ignoredSet.has(r.pis)) continue;
    (byPis.get(r.pis) ?? byPis.set(r.pis, []).get(r.pis)!).push(r);
  }

  const pisSummaries = [...byPis.entries()].map(([pis, records]) => {
    const entradaHours = records.filter((r) => r.markType === "ENTRADA").map((r) => {
      const local = toZonedTime(r.timestamp, APP_TIMEZONE);
      return local.getHours() * 60 + local.getMinutes();
    });
    const avgEntradaMinutes = entradaHours.length > 0 ? Math.round(entradaHours.reduce((a, b) => a + b, 0) / entradaHours.length) : null;
    const dates = [...new Set(records.map((r) => formatInTimeZone(r.timestamp, APP_TIMEZONE, "yyyy-MM-dd")))].sort();
    return {
      pis,
      recordCount: records.length,
      dateCount: dates.length,
      dates,
      avgEntradaTime:
        avgEntradaMinutes !== null ? `${String(Math.floor(avgEntradaMinutes / 60)).padStart(2, "0")}:${String(avgEntradaMinutes % 60).padStart(2, "0")}` : null,
      sample: records.slice(0, 6).map((r) => ({ time: formatInTimeZone(r.timestamp, APP_TIMEZONE, "yyyy-MM-dd HH:mm"), markType: r.markType })),
    };
  });

  // Colaboradores ativos sem pis cadastrado (candidatos a ter batidas orfas) — com turno.
  const collaboratorsNoPis = await db.collaborator.findMany({
    where: { active: true, pis: null },
    include: { turno: true },
    orderBy: { name: "asc" },
  });

  const candidateInfo = collaboratorsNoPis.map((c) => ({
    id: c.id,
    name: c.name,
    matricula: c.matricula,
    turnoName: c.turno?.name,
    startTime: c.turno?.startTime,
  }));

  return NextResponse.json({
    unmatchedPisCount: pisSummaries.length,
    pisSummaries: pisSummaries.sort((a, b) => b.recordCount - a.recordCount),
    collaboratorsWithoutPisCount: candidateInfo.length,
    collaboratorsWithoutPis: candidateInfo,
  });
}
