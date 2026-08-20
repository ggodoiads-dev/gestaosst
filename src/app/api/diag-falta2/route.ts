import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { formatInTimeZone } from "date-fns-tz";

const TOKEN = "7d3a9f2c6e0b8a4d1f7c3e9b6a2d8f5c0e4b7a1d9f3c6e8b2a5d0f7c4e9b1a6d";
const APP_TIMEZONE = "America/Sao_Paulo";

const NAMES = [
  "GIOVANE RODRIGUES DE MATTOS",
  "ISRAEL DE LIMA BARBOZA",
  "JESSICA ALINE FERREIRA PINTO",
  "KAOANY CRISTINE DE PAULA",
  "VANDERCLEISON LUCAS DE OLIVEIRA",
  "ALEX CLEITON DE FREITAS",
  "ANDRE LUIZ DE LIMA ALVES",
  "CARLOS DANIEL MACHADO",
];

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const from = new Date(2026, 7, 14, 0, 0, 0);
  const to = new Date(2026, 7, 17, 0, 0, 0);

  const collaborators = await db.collaborator.findMany({
    where: { name: { in: NAMES, mode: "insensitive" } },
    include: { turno: true },
  });

  const unmatched = await db.timeClockRecord.findMany({
    where: { collaboratorId: null, timestamp: { gte: from, lte: to } },
    orderBy: { timestamp: "asc" },
  });
  const unmatchedByPis: Record<string, { time: string; markType: string }[]> = {};
  for (const r of unmatched) {
    (unmatchedByPis[r.pis] ??= []).push({ time: formatInTimeZone(r.timestamp, APP_TIMEZONE, "yyyy-MM-dd HH:mm"), markType: r.markType });
  }

  const results = await Promise.all(
    collaborators.map(async (c) => {
      const own = await db.timeClockRecord.findMany({
        where: { collaboratorId: c.id, timestamp: { gte: from, lte: to } },
        orderBy: { timestamp: "asc" },
      });
      return {
        name: c.name,
        pis: c.pis,
        matricula: c.matricula,
        turnoName: c.turno?.name,
        startTime: c.turno?.startTime,
        ownRecords14a17: own.map((r) => ({ time: formatInTimeZone(r.timestamp, APP_TIMEZONE, "yyyy-MM-dd HH:mm"), markType: r.markType })),
      };
    }),
  );

  const foundNames = new Set(collaborators.map((c) => c.name.toUpperCase()));
  const notFound = NAMES.filter((n) => !foundNames.has(n.toUpperCase()));

  return NextResponse.json({
    collaboratorsChecked: results,
    notFoundInDb: notFound,
    unmatchedPisCount: Object.keys(unmatchedByPis).length,
    unmatchedByPis,
  });
}
