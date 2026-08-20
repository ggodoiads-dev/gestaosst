import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz";
import { getCollaboratorDayStatus } from "@/domain/schedule/schedule-calendar";

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

  const name = request.nextUrl.searchParams.get("name");
  const idParam = request.nextUrl.searchParams.get("id");
  if (!name && !idParam) {
    const matches = await db.collaborator.findMany({
      where: { name: { contains: "alex", mode: "insensitive" } },
      select: { id: true, name: true, matricula: true },
    });
    return NextResponse.json({ matches });
  }

  const collaborator = idParam
    ? await db.collaborator.findUnique({ where: { id: idParam }, include: { turno: { include: { scheduleType: true } } } })
    : await db.collaborator.findFirst({
        where: { name: { contains: name!, mode: "insensitive" } },
        include: { turno: { include: { scheduleType: true } } },
      });
  if (!collaborator) return NextResponse.json({ error: "colaborador não encontrado" });

  // Replica exatamente o range padrão da tela (hoje - 13 dias até hoje).
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 13);

  const rangeStartUtc = fromZonedTime(new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0), APP_TIMEZONE);
  const rangeEndUtc = fromZonedTime(new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59), APP_TIMEZONE);

  // Todas as batidas do colaborador (sem filtro de range) pra ver o que existe de verdade.
  const allRecords = await db.timeClockRecord.findMany({
    where: { collaboratorId: collaborator.id },
    orderBy: { timestamp: "asc" },
  });
  // Só as batidas que a query real do relatório buscaria (com o filtro de timestamp).
  const inRangeRecords = allRecords.filter((r) => r.timestamp >= rangeStartUtc && r.timestamp <= rangeEndUtc);

  const notes = await db.scheduleDayNote.findMany({ where: { collaboratorId: collaborator.id, date: { gte: from, lte: to } } });
  const noteByKey = new Map(notes.map((n) => [dayKeyFromLocalDate(n.date), n]));

  const shiftStartTime = collaborator.turno?.startTime ?? null;

  const recordsByDay = new Map<string, typeof allRecords>();
  for (const r of inRangeRecords) {
    const key = workdayKeyFromTimestamp(r.timestamp, shiftStartTime);
    (recordsByDay.get(key) ?? recordsByDay.set(key, []).get(key)!).push(r);
  }

  const allRecordsByDay = new Map<string, typeof allRecords>();
  for (const r of allRecords) {
    const key = workdayKeyFromTimestamp(r.timestamp, shiftStartTime);
    (allRecordsByDay.get(key) ?? allRecordsByDay.set(key, []).get(key)!).push(r);
  }

  const days: Record<string, unknown> = {};
  const cursor = new Date(from);
  while (cursor <= to) {
    const dayKey = dayKeyFromLocalDate(cursor);
    const note = noteByKey.get(dayKey);
    const scheduled = note ? note.overrideStatus : getCollaboratorDayStatus(cursor, collaborator as never);
    const dayRecordsInRange = (recordsByDay.get(dayKey) ?? []).map((r) => ({
      time: formatInTimeZone(r.timestamp, APP_TIMEZONE, "yyyy-MM-dd HH:mm"),
      markType: r.markType,
    }));
    const dayRecordsAll = (allRecordsByDay.get(dayKey) ?? []).map((r) => ({
      time: formatInTimeZone(r.timestamp, APP_TIMEZONE, "yyyy-MM-dd HH:mm"),
      markType: r.markType,
    }));
    days[dayKey] = {
      scheduled,
      noteOverride: note ? note.overrideStatus : null,
      hasPunchesInRange: dayRecordsInRange.length > 0,
      dayRecordsInRange,
      dayRecordsAllTime: dayRecordsAll,
      mismatchFlag: scheduled === "TRABALHO" && dayRecordsInRange.length === 0 && dayRecordsAll.length > 0,
    };
    cursor.setDate(cursor.getDate() + 1);
  }

  return NextResponse.json({
    collaborator: { name: collaborator.name, matricula: collaborator.matricula, turnoName: collaborator.turno?.name, startTime: shiftStartTime },
    range: { from: dayKeyFromLocalDate(from), to: dayKeyFromLocalDate(to) },
    totalRecordsAllTime: allRecords.length,
    totalRecordsInRange: inRangeRecords.length,
    days,
  });
}
