import "server-only";
import { fromZonedTime, toZonedTime, formatInTimeZone } from "date-fns-tz";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import { parseAfdt } from "@/domain/time-clock/afdt-parser";
import { getDayStatus } from "@/domain/schedule/schedule-calendar";
import { APP_TIMEZONE, formatTime } from "@/lib/dates";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";

const LATE_TOLERANCE_MINUTES = 5;

export type TimeClockImportSummary = {
  totalRecords: number;
  matched: number;
  unmatched: number;
  unmatchedPis: string[];
  ignoredLines: number;
};

/**
 * Importa um arquivo AFDT: casa cada marcação pelo PIS do colaborador e grava de forma
 * idempotente (`createMany` + `skipDuplicates`, chave `[pis, timestamp, markNumber]`) — reenviar
 * o mesmo arquivo não duplica nada. Quando o PIS de uma marcação já gravada antes (sem
 * colaborador correspondente na época) passa a ter dono, o `updateMany` final corrige o vínculo
 * sem precisar reimportar tudo de novo.
 */
export async function importTimeClockFile(user: CurrentUser, buffer: Buffer): Promise<TimeClockImportSummary> {
  requirePermission(user, PERMISSIONS.HR_MANAGE);

  const { marks, ignoredLines } = parseAfdt(buffer.toString("utf-8"));

  const distinctPis = [...new Set(marks.map((m) => m.pis))];
  const collaborators = distinctPis.length > 0 ? await db.collaborator.findMany({ where: { pis: { in: distinctPis } } }) : [];
  const collaboratorByPis = new Map(collaborators.filter((c) => c.pis).map((c) => [c.pis as string, c]));

  const unmatchedPis = new Set<string>();
  let matched = 0;

  const data = marks.map((mark) => {
    const collaborator = collaboratorByPis.get(mark.pis);
    if (collaborator) matched++;
    else unmatchedPis.add(mark.pis);

    return {
      collaboratorId: collaborator?.id ?? null,
      pis: mark.pis,
      timestamp: mark.timestamp,
      markType: mark.markType,
      markNumber: mark.markNumber,
      origin: mark.origin,
      reason: mark.reason,
      importedById: user.id,
    };
  });

  if (data.length > 0) {
    await db.timeClockRecord.createMany({ data, skipDuplicates: true });
  }

  for (const [pis, collaborator] of collaboratorByPis) {
    await db.timeClockRecord.updateMany({ where: { pis, collaboratorId: null }, data: { collaboratorId: collaborator.id } });
  }

  await recordAudit({
    userId: user.id,
    action: "CREATE",
    entityType: "TimeClockImport",
    entityId: crypto.randomUUID(),
    newValue: { totalRecords: marks.length, matched, unmatched: unmatchedPis.size, ignoredLines },
  });

  return {
    totalRecords: marks.length,
    matched,
    unmatched: marks.length - matched,
    unmatchedPis: [...unmatchedPis],
    ignoredLines,
  };
}

export type TimeClockAnomalyType = "ATRASO" | "FALTA" | "CHECKLIST_PENDENTE" | "BATIDA_IMPAR";

export type TimeClockAnomaly = {
  collaboratorId: string;
  collaboratorName: string;
  date: string; // yyyy-MM-dd
  type: TimeClockAnomalyType;
  detail: string;
};

/** Chave de dia a partir de uma data "de negócio" já âncorada ao meio-dia local (Turno.startDate,
 * ScheduleDayNote.date, limites do período pedido) — mesmo padrão de `localDateKey` em schedule.service.ts. */
function dayKeyFromLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Chave de dia a partir de um instante real (TimeClockRecord.timestamp, ChecklistExecution.startedAt)
 * — precisa converter explicitamente pro fuso de São Paulo, já que o processo pode rodar em UTC. */
function dayKeyFromTimestamp(timestamp: Date): string {
  return formatInTimeZone(timestamp, APP_TIMEZONE, "yyyy-MM-dd");
}

/**
 * Cruza as batidas de ponto importadas com escala, checklist e o próprio padrão par/ímpar de
 * marcações do dia, gerando as ocorrências: atraso, falta, checklist não realizado e batida
 * ímpar (sinal de esquecimento). `from`/`to` são datas de negócio (meio-dia local).
 */
export async function getTimeClockReport(
  user: CurrentUser,
  range: { from: Date; to: Date },
): Promise<TimeClockAnomaly[]> {
  requirePermission(user, PERMISSIONS.HR_MANAGE);

  const rangeStartUtc = fromZonedTime(
    new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate(), 0, 0, 0),
    APP_TIMEZONE,
  );
  const rangeEndUtc = fromZonedTime(
    new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate(), 23, 59, 59),
    APP_TIMEZONE,
  );

  const collaborators = await db.collaborator.findMany({
    where: { active: true },
    include: { turno: { include: { scheduleType: true } } },
  });
  const collaboratorIds = collaborators.map((c) => c.id);
  if (collaboratorIds.length === 0) return [];

  const userIds = collaborators.filter((c) => c.userId).map((c) => c.userId as string);

  const [records, notes, executions] = await Promise.all([
    db.timeClockRecord.findMany({
      where: { collaboratorId: { in: collaboratorIds }, timestamp: { gte: rangeStartUtc, lte: rangeEndUtc } },
      orderBy: { timestamp: "asc" },
    }),
    db.scheduleDayNote.findMany({
      where: { collaboratorId: { in: collaboratorIds }, date: { gte: range.from, lte: range.to } },
    }),
    userIds.length > 0
      ? db.checklistExecution.findMany({
          where: { executedById: { in: userIds }, startedAt: { gte: rangeStartUtc, lte: rangeEndUtc } },
          select: { executedById: true, startedAt: true },
        })
      : Promise.resolve([]),
  ]);

  const recordsByCollaboratorDay = new Map<string, typeof records>();
  for (const rec of records) {
    if (!rec.collaboratorId) continue;
    const key = `${rec.collaboratorId}-${dayKeyFromTimestamp(rec.timestamp)}`;
    const arr = recordsByCollaboratorDay.get(key);
    if (arr) arr.push(rec);
    else recordsByCollaboratorDay.set(key, [rec]);
  }

  const noteByKey = new Map(notes.map((n) => [`${n.collaboratorId}-${dayKeyFromLocalDate(n.date)}`, n]));

  const executionDaysByUser = new Map<string, Set<string>>();
  for (const exec of executions) {
    const day = dayKeyFromTimestamp(exec.startedAt);
    const set = executionDaysByUser.get(exec.executedById);
    if (set) set.add(day);
    else executionDaysByUser.set(exec.executedById, new Set([day]));
  }

  const anomalies: TimeClockAnomaly[] = [];

  for (const collaborator of collaborators) {
    const cursor = new Date(range.from);
    while (cursor <= range.to) {
      const dayKey = dayKeyFromLocalDate(cursor);
      const dayRecords = (recordsByCollaboratorDay.get(`${collaborator.id}-${dayKey}`) ?? [])
        .slice()
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      const hasPunches = dayRecords.length > 0;

      if (collaborator.turno) {
        const note = noteByKey.get(`${collaborator.id}-${dayKey}`);
        const scheduled = note
          ? note.overrideStatus
          : getDayStatus(
              cursor,
              collaborator.turno.startDate,
              collaborator.turno.scheduleType.workDays,
              collaborator.turno.scheduleType.restDays,
            );

        if (scheduled === "TRABALHO" && !hasPunches) {
          anomalies.push({
            collaboratorId: collaborator.id,
            collaboratorName: collaborator.name,
            date: dayKey,
            type: "FALTA",
            detail: "Nenhuma batida de ponto registrada no dia",
          });
        }
      }

      if (hasPunches) {
        if (collaborator.turno?.startTime) {
          const firstEntrada = dayRecords.find((r) => r.markType === "ENTRADA");
          if (firstEntrada) {
            const [schedHour, schedMinute] = collaborator.turno.startTime.split(":").map(Number);
            const localEntrada = toZonedTime(firstEntrada.timestamp, APP_TIMEZONE);
            const actualMinutes = localEntrada.getHours() * 60 + localEntrada.getMinutes();
            const scheduledMinutes = schedHour * 60 + schedMinute;
            const lateBy = actualMinutes - scheduledMinutes;
            if (lateBy > LATE_TOLERANCE_MINUTES) {
              anomalies.push({
                collaboratorId: collaborator.id,
                collaboratorName: collaborator.name,
                date: dayKey,
                type: "ATRASO",
                detail: `${lateBy} min de atraso (previsto ${collaborator.turno.startTime}, batido às ${formatTime(firstEntrada.timestamp)})`,
              });
            }
          }
        }

        if (dayRecords.length % 2 !== 0) {
          anomalies.push({
            collaboratorId: collaborator.id,
            collaboratorName: collaborator.name,
            date: dayKey,
            type: "BATIDA_IMPAR",
            detail: `${dayRecords.length} batida(s) no dia — número ímpar, sinal de esquecimento`,
          });
        }

        if (collaborator.checklistEnabled && collaborator.userId) {
          const executedDays = executionDaysByUser.get(collaborator.userId);
          if (!executedDays?.has(dayKey)) {
            anomalies.push({
              collaboratorId: collaborator.id,
              collaboratorName: collaborator.name,
              date: dayKey,
              type: "CHECKLIST_PENDENTE",
              detail: "Bateu ponto mas não realizou nenhum checklist no dia",
            });
          }
        }
      }

      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return anomalies.sort((a, b) => (a.date === b.date ? a.collaboratorName.localeCompare(b.collaboratorName) : a.date < b.date ? 1 : -1));
}
