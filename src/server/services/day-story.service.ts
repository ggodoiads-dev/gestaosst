import "server-only";
import { addDays, format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/server/db";
import { hasPermission, type CurrentUser } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { APP_TIMEZONE, formatLongDate } from "@/lib/dates";

export type DayStory = {
  /** "domingo, 1 de novembro" */
  dayLabel: string;
  /** Checklists concluídos por hora (0 a 23, horário de Brasília). */
  byHour: number[];
  total: number;
  peakHour: number | null;
  ncsOpened: number;
};

/** O último dia fechado (ontem) contado hora a hora: checklists concluídos e NCs abertas. Alimenta o capítulo "Ontem, hora a hora" da tela inicial. Sem permissão ou sem dado, devolve null. */
export async function getYesterdayStory(user: CurrentUser): Promise<DayStory | null> {
  if (!hasPermission(user, PERMISSIONS.INDICATORS_VIEW_CONSOLIDATED) && !hasPermission(user, PERMISSIONS.CHECKLIST_COMPLIANCE_VIEW)) return null;
  const todayKey = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
  const [y, m, d] = todayKey.split("-").map(Number);
  const yesterday = addDays(new Date(y, m - 1, d), -1);
  const yKey = format(yesterday, "yyyy-MM-dd");
  const start = new Date(`${yKey}T00:00:00-03:00`);
  const end = new Date(start.getTime() + 24 * 3600 * 1000);
  try {
    const [executions, ncs] = await Promise.all([
      db.checklistExecution.findMany({ where: { status: "CONCLUIDO", finishedAt: { gte: start, lt: end } }, select: { finishedAt: true } }),
      db.nonconformity.count({ where: { identifiedAt: { gte: start, lt: end } } }),
    ]);
    const byHour = Array.from({ length: 24 }, () => 0);
    for (const e of executions) {
      if (!e.finishedAt) continue;
      byHour[Number(formatInTimeZone(e.finishedAt, APP_TIMEZONE, "H"))]++;
    }
    const total = byHour.reduce((s, v) => s + v, 0);
    const max = Math.max(...byHour);
    return {
      dayLabel: formatLongDate(start),
      byHour,
      total,
      peakHour: total > 0 ? byHour.indexOf(max) : null,
      ncsOpened: ncs,
    };
  } catch (error) {
    console.error("[day-story] indisponível:", error);
    return null;
  }
}
