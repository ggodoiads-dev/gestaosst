import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import type { Periodicity } from "@/generated/prisma/enums";
import { APP_TIMEZONE } from "@/lib/dates";

/**
 * Cálculo determinístico de ocorrências previstas e atraso (seções 25 e 27
 * do documento). `daysOfWeek` é reaproveitado como lista de dias da semana
 * (0-6, domingo=0) para periodicidade SEMANAL, ou lista de dias do mês
 * (1-31) para MENSAL — evita colunas extras para uma regra que ainda pode
 * expandir no futuro.
 */

export type ScheduleInput = {
  periodicity: Periodicity;
  timeOfDay: string | null; // "HH:mm"
  daysOfWeek: string | null; // CSV
};

function parseTimeOfDay(timeOfDay: string | null): { hours: number; minutes: number } {
  if (!timeOfDay) return { hours: 7, minutes: 0 };
  const [h, m] = timeOfDay.split(":").map((n) => parseInt(n, 10));
  return { hours: Number.isFinite(h) ? h : 7, minutes: Number.isFinite(m) ? m : 0 };
}

function parseCsvNumbers(csv: string | null): number[] {
  if (!csv) return [];
  return csv
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));
}

/**
 * Retorna o horário previsto (Date) para a data de referência informada,
 * ou `null` se a periodicidade não gera ocorrência nesse dia.
 * Para POR_TURNO/DIARIO/ANTES_DO_USO/DEPOIS_DO_USO/PERSONALIZADO considera
 * uma ocorrência por dia — turnos adicionais são modelados como agendas
 * (ChecklistSchedule) separadas para o mesmo equipamento.
 *
 * `timeOfDay` é sempre um horário de relógio de parede em São Paulo (seção 60),
 * não um offset UTC — construir o Date com `setHours` (fuso do runtime) dava
 * horário errado em produção, onde o servidor roda em UTC. `fromZonedTime`
 * converte explicitamente o horário de parede em SP pro instante UTC correto,
 * independente do fuso em que o processo está rodando.
 */
export function getScheduledTimeForDate(schedule: ScheduleInput, referenceDate: Date): Date | null {
  const { hours, minutes } = parseTimeOfDay(schedule.timeOfDay);
  const spDateStr = formatInTimeZone(referenceDate, APP_TIMEZONE, "yyyy-MM-dd");
  const scheduled = fromZonedTime(
    `${spDateStr} ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`,
    APP_TIMEZONE,
  );
  const [year, month, dayOfMonth] = spDateStr.split("-").map(Number);
  const dayOfWeek = new Date(year, month - 1, dayOfMonth).getDay();

  switch (schedule.periodicity) {
    case "SEMANAL": {
      const allowedDays = parseCsvNumbers(schedule.daysOfWeek);
      if (allowedDays.length === 0 || allowedDays.includes(dayOfWeek)) {
        return scheduled;
      }
      return null;
    }
    case "MENSAL": {
      const allowedDates = parseCsvNumbers(schedule.daysOfWeek);
      if (allowedDates.length === 0 || allowedDates.includes(dayOfMonth)) {
        return scheduled;
      }
      return null;
    }
    case "DIARIO":
    case "POR_TURNO":
    case "ANTES_DO_USO":
    case "DEPOIS_DO_USO":
    case "PERSONALIZADO":
    default:
      return scheduled;
  }
}

/** Atraso em minutos entre o horário previsto e o horário real de finalização (seção 27). Nunca negativo. */
export function computeDelayMinutes(scheduledFor: Date | null, finishedAt: Date): number | null {
  if (!scheduledFor) return null;
  const diffMs = finishedAt.getTime() - scheduledFor.getTime();
  return Math.max(0, Math.round(diffMs / 60000));
}

export function isLate(scheduledFor: Date | null, referenceNow: Date): boolean {
  if (!scheduledFor) return false;
  return referenceNow.getTime() > scheduledFor.getTime();
}
