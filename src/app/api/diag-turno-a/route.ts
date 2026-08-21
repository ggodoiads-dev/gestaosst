import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

const TOKEN = "7d3a9f2c6e0b8a4d1f7c3e9b6a2d8f5c0e4b7a1d9f3c6e8b2a5d0f7c4e9b1a6d";
const APP_TIMEZONE = "America/Sao_Paulo";

function dayKeyFromLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function workdayKeyFromTimestamp(timestamp: Date, shiftStartTime: string | null | undefined): string {
  if (!shiftStartTime) return formatInTimeZone(timestamp, APP_TIMEZONE, "yyyy-MM-dd");
  const [startHour, startMinute] = shiftStartTime.split(":").map(Number);
  if (!Number.isFinite(startHour) || !Number.isFinite(startMinute)) return formatInTimeZone(timestamp, APP_TIMEZONE, "yyyy-MM-dd");
  const cutoffTotalMinutes = (startHour * 60 + startMinute + 12 * 60) % (24 * 60);
  const cutoffHour = Math.floor(cutoffTotalMinutes / 60);
  const cutoffMinute = cutoffTotalMinutes % 60;
  const local = toZonedTime(timestamp, APP_TIMEZONE);
  const shifted = new Date(local);
  shifted.setHours(shifted.getHours() - cutoffHour, shifted.getMinutes() - cutoffMinute, shifted.getSeconds(), 0);
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, "0");
  const d = String(shifted.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const turnoA = await db.turno.findFirst({ where: { name: "A" } });
  if (!turnoA) return NextResponse.json({ error: "turno A não encontrado" });

  const collaborators = await db.collaborator.findMany({
    where: { turnoId: turnoA.id, active: true },
    select: { id: true, name: true, matricula: true, pis: true },
    orderBy: { name: "asc" },
  });

  const from = new Date(2026, 7, 15, 0, 0, 0);
  const to = new Date(2026, 7, 21, 23, 59, 59);

  const results = await Promise.all(
    collaborators.map(async (c) => {
      const records = await db.timeClockRecord.findMany({
        where: { collaboratorId: c.id, timestamp: { gte: from, lte: to } },
        orderBy: { timestamp: "asc" },
      });
      const byWorkday: Record<string, { time: string; markType: string; calendarDay: string }[]> = {};
      for (const r of records) {
        const key = workdayKeyFromTimestamp(r.timestamp, turnoA.startTime);
        (byWorkday[key] ??= []).push({
          time: formatInTimeZone(r.timestamp, APP_TIMEZONE, "yyyy-MM-dd HH:mm"),
          markType: r.markType,
          calendarDay: dayKeyFromLocalDate(toZonedTime(r.timestamp, APP_TIMEZONE)),
        });
      }
      return {
        id: c.id,
        name: c.name,
        matricula: c.matricula,
        pis: c.pis,
        totalRecordsInWindow: records.length,
        byWorkday,
      };
    }),
  );

  return NextResponse.json({
    turnoAId: turnoA.id,
    turnoStartTime: turnoA.startTime,
    collaboratorCount: collaborators.length,
    results,
  });
}
