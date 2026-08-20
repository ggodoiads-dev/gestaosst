import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

const TOKEN = "7d3a9f2c6e0b8a4d1f7c3e9b6a2d8f5c0e4b7a1d9f3c6e8b2a5d0f7c4e9b1a6d";
const APP_TIMEZONE = "America/Sao_Paulo";

function dayKeyFromTimestamp(timestamp: Date): string {
  return formatInTimeZone(timestamp, APP_TIMEZONE, "yyyy-MM-dd");
}

function workdayKeyFromTimestamp(timestamp: Date, shiftStartTime: string | null | undefined): string {
  if (!shiftStartTime) return dayKeyFromTimestamp(timestamp);
  const [startHour, startMinute] = shiftStartTime.split(":").map(Number);
  if (!Number.isFinite(startHour) || !Number.isFinite(startMinute)) return dayKeyFromTimestamp(timestamp);
  const local = toZonedTime(timestamp, APP_TIMEZONE);
  const shifted = new Date(local);
  shifted.setHours(shifted.getHours() - startHour, shifted.getMinutes() - startMinute, shifted.getSeconds(), 0);
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
    ? await db.collaborator.findUnique({ where: { id: idParam }, include: { turno: true } })
    : await db.collaborator.findFirst({ where: { name: { contains: name!, mode: "insensitive" } }, include: { turno: true } });
  if (!collaborator) return NextResponse.json({ error: "colaborador não encontrado" });

  const records = await db.timeClockRecord.findMany({
    where: { collaboratorId: collaborator.id },
    orderBy: { timestamp: "asc" },
  });

  const shiftStartTime = collaborator.turno?.startTime ?? null;

  const oldGrouping: Record<string, { time: string; markType: string }[]> = {};
  const newGrouping: Record<string, { time: string; markType: string }[]> = {};
  for (const r of records) {
    const oldKey = dayKeyFromTimestamp(r.timestamp);
    const newKey = workdayKeyFromTimestamp(r.timestamp, shiftStartTime);
    const entry = { time: formatInTimeZone(r.timestamp, APP_TIMEZONE, "yyyy-MM-dd HH:mm"), markType: r.markType };
    (oldGrouping[oldKey] ??= []).push(entry);
    (newGrouping[newKey] ??= []).push(entry);
  }

  return NextResponse.json({
    collaborator: { name: collaborator.name, matricula: collaborator.matricula, turnoName: collaborator.turno?.name, startTime: shiftStartTime },
    totalRecords: records.length,
    oldGrouping,
    newGrouping,
  });
}
