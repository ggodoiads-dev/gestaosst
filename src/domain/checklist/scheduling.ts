import type { Periodicity } from "@/generated/prisma/enums";

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
 */
export function getScheduledTimeForDate(schedule: ScheduleInput, referenceDate: Date): Date | null {
  const { hours, minutes } = parseTimeOfDay(schedule.timeOfDay);
  const day = new Date(referenceDate);
  day.setHours(hours, minutes, 0, 0);

  switch (schedule.periodicity) {
    case "SEMANAL": {
      const allowedDays = parseCsvNumbers(schedule.daysOfWeek);
      if (allowedDays.length === 0 || allowedDays.includes(referenceDate.getDay())) {
        return day;
      }
      return null;
    }
    case "MENSAL": {
      const allowedDates = parseCsvNumbers(schedule.daysOfWeek);
      if (allowedDates.length === 0 || allowedDates.includes(referenceDate.getDate())) {
        return day;
      }
      return null;
    }
    case "DIARIO":
    case "POR_TURNO":
    case "ANTES_DO_USO":
    case "DEPOIS_DO_USO":
    case "PERSONALIZADO":
    default:
      return day;
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
