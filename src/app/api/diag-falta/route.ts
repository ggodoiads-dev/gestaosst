import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { formatInTimeZone } from "date-fns-tz";

const TOKEN = "2e8a5c1f9d6b3a7e0f4c8b2d5a9e6f1c3b7d0a4e8f2c6b9d1a5e3f7c0b4d8a2e";
const APP_TIMEZONE = "America/Sao_Paulo";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const name = request.nextUrl.searchParams.get("name") ?? "GABRIEL DE JESUS BATISTEL";

  const collaborator = await db.collaborator.findFirst({
    where: { name: { contains: name, mode: "insensitive" } },
    include: { turno: { include: { scheduleType: true } } },
  });
  if (!collaborator) return NextResponse.json({ error: "colaborador não encontrado" });

  const records = await db.timeClockRecord.findMany({
    where: { collaboratorId: collaborator.id },
    orderBy: { timestamp: "asc" },
  });

  const recordsByDay: Record<string, { timestamp: string; markType: string }[]> = {};
  for (const r of records) {
    const day = formatInTimeZone(r.timestamp, APP_TIMEZONE, "yyyy-MM-dd");
    recordsByDay[day] = recordsByDay[day] ?? [];
    recordsByDay[day].push({ timestamp: formatInTimeZone(r.timestamp, APP_TIMEZONE, "yyyy-MM-dd HH:mm"), markType: r.markType });
  }

  const notes = await db.scheduleDayNote.findMany({ where: { collaboratorId: collaborator.id } });

  return NextResponse.json({
    collaborator: {
      id: collaborator.id,
      name: collaborator.name,
      matricula: collaborator.matricula,
      pis: collaborator.pis,
      turno: collaborator.turno
        ? {
            name: collaborator.turno.name,
            startDate: collaborator.turno.startDate,
            scheduleType: collaborator.turno.scheduleType.name,
            workDays: collaborator.turno.scheduleType.workDays,
            restDays: collaborator.turno.scheduleType.restDays,
          }
        : null,
      scheduleStartDate: collaborator.scheduleStartDate,
    },
    totalRecords: records.length,
    recordsByDay,
    scheduleDayNotes: notes,
  });
}
