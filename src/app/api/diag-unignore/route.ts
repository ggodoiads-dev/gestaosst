import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

const TOKEN = "7d3a9f2c6e0b8a4d1f7c3e9b6a2d8f5c0e4b7a1d9f3c6e8b2a5d0f7c4e9b1a6d";
const APP_TIMEZONE = "America/Sao_Paulo";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Desfaz o "Ignorar todos" de 2026-08-20 09:56 (horário de São Paulo, UTC-3) — remove só os que
  // foram ignorados nesse minuto, sem mexer em nenhum ignore anterior/futuro feito de propósito.
  const windowStart = new Date("2026-08-20T12:55:00.000Z");
  const windowEnd = new Date("2026-08-20T12:57:00.000Z");
  const toRemove = await db.ignoredTimeClockPis.findMany({ where: { ignoredAt: { gte: windowStart, lte: windowEnd } } });
  const deleted = await db.ignoredTimeClockPis.deleteMany({ where: { ignoredAt: { gte: windowStart, lte: windowEnd } } });

  const unmatchedRecords = await db.timeClockRecord.findMany({
    where: { collaboratorId: null },
    orderBy: [{ pis: "asc" }, { timestamp: "asc" }],
  });
  const stillIgnored = await db.ignoredTimeClockPis.findMany({ select: { pis: true } });
  const stillIgnoredSet = new Set(stillIgnored.map((i) => i.pis));

  const byPis = new Map<string, typeof unmatchedRecords>();
  for (const r of unmatchedRecords) {
    if (stillIgnoredSet.has(r.pis)) continue;
    (byPis.get(r.pis) ?? byPis.set(r.pis, []).get(r.pis)!).push(r);
  }

  const pisSummaries = [...byPis.entries()].map(([pis, records]) => {
    const entradaMinutes = records.filter((r) => r.markType === "ENTRADA").map((r) => {
      const local = toZonedTime(r.timestamp, APP_TIMEZONE);
      return local.getHours() * 60 + local.getMinutes();
    });
    const avg = entradaMinutes.length > 0 ? Math.round(entradaMinutes.reduce((a, b) => a + b, 0) / entradaMinutes.length) : null;
    const dates = [...new Set(records.map((r) => formatInTimeZone(r.timestamp, APP_TIMEZONE, "yyyy-MM-dd")))].sort();
    return {
      pis,
      recordCount: records.length,
      dates,
      avgEntradaTime: avg !== null ? `${String(Math.floor(avg / 60)).padStart(2, "0")}:${String(avg % 60).padStart(2, "0")}` : null,
    };
  });

  return NextResponse.json({
    removedFromIgnoreList: deleted.count,
    removedPisList: toRemove.map((r) => r.pis),
    unmatchedNowVisibleCount: pisSummaries.length,
    pisSummaries: pisSummaries.sort((a, b) => (a.avgEntradaTime ?? "").localeCompare(b.avgEntradaTime ?? "")),
  });
}
