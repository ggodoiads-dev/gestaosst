import "server-only";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/auth/current-user";
import { hasPermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { currentMonthKey } from "@/lib/month";

/** Ver presença/faltas: quem gerencia escala (RH/gestão) ou o perfil só-leitura (Auditor). */
function requireAttendanceView(user: CurrentUser): void {
  if (
    !hasPermission(user, PERMISSIONS.ATTENDANCE_VIEW) &&
    !hasPermission(user, PERMISSIONS.SCHEDULE_MANAGE) &&
    !hasPermission(user, PERMISSIONS.HR_MANAGE)
  ) {
    throw new ForbiddenError();
  }
}

/** Só estes dois status são ausência de verdade (os outros — férias, troca, BH+ — não entram). */
const ABSENCE_STATUSES = ["FALTA", "ATESTADO"] as const;
type AbsenceStatus = (typeof ABSENCE_STATUSES)[number];

export type AbsenceEntry = {
  date: string;
  collaboratorId: string;
  name: string;
  area: string | null;
  turno: string | null;
  status: AbsenceStatus;
};

export type AbsenceMonthSummary = { month: string; faltas: number; atestados: number; people: number };

export type AbsenceOverview = {
  month: string;
  faltas: number;
  atestados: number;
  people: number;
  entries: AbsenceEntry[];
  perDay: { date: string; count: number }[];
  ranking: { collaboratorId: string; name: string; faltas: number; atestados: number }[];
  history: AbsenceMonthSummary[];
};

function localKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Faltas e atestados de um mês, só leitura. Propositalmente SEM o texto livre das observações nem
 * os anexos (atestado pode ser dado de saúde) e SEM nada de RH (salário, CPF) — só quem, quando,
 * área/turno e o tipo. O histórico mensal fica sempre disponível porque é calculado dos registros. */
export async function getAbsenceOverview(user: CurrentUser, month: string = currentMonthKey()): Promise<AbsenceOverview> {
  requireAttendanceView(user);

  const [y, m] = month.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);

  const notes = await db.scheduleDayNote.findMany({
    where: { status: { in: [...ABSENCE_STATUSES] } },
    select: {
      date: true,
      status: true,
      collaborator: { select: { id: true, name: true, area: { select: { name: true } }, turno: { select: { name: true } } } },
    },
    orderBy: { date: "asc" },
  });

  const entries: AbsenceEntry[] = [];
  const monthAgg = new Map<string, { faltas: number; atestados: number; people: Set<string> }>();

  for (const n of notes) {
    if (!n.status) continue;
    const status = n.status as AbsenceStatus;
    const key = `${n.date.getFullYear()}-${String(n.date.getMonth() + 1).padStart(2, "0")}`;
    const agg = monthAgg.get(key) ?? { faltas: 0, atestados: 0, people: new Set<string>() };
    if (status === "FALTA") agg.faltas++;
    else agg.atestados++;
    agg.people.add(n.collaborator.id);
    monthAgg.set(key, agg);

    if (n.date >= start && n.date < end) {
      entries.push({
        date: localKey(n.date),
        collaboratorId: n.collaborator.id,
        name: n.collaborator.name,
        area: n.collaborator.area?.name ?? null,
        turno: n.collaborator.turno ? `Turno ${n.collaborator.turno.name}` : null,
        status,
      });
    }
  }

  const perDayMap = new Map<string, number>();
  const rankingMap = new Map<string, { collaboratorId: string; name: string; faltas: number; atestados: number }>();
  for (const e of entries) {
    perDayMap.set(e.date, (perDayMap.get(e.date) ?? 0) + 1);
    const r = rankingMap.get(e.collaboratorId) ?? { collaboratorId: e.collaboratorId, name: e.name, faltas: 0, atestados: 0 };
    if (e.status === "FALTA") r.faltas++;
    else r.atestados++;
    rankingMap.set(e.collaboratorId, r);
  }

  const months = new Set<string>([currentMonthKey(), month, ...monthAgg.keys()]);
  const history: AbsenceMonthSummary[] = Array.from(months)
    .sort((a, b) => b.localeCompare(a))
    .map((k) => {
      const a = monthAgg.get(k);
      return { month: k, faltas: a?.faltas ?? 0, atestados: a?.atestados ?? 0, people: a?.people.size ?? 0 };
    });

  return {
    month,
    faltas: entries.filter((e) => e.status === "FALTA").length,
    atestados: entries.filter((e) => e.status === "ATESTADO").length,
    people: rankingMap.size,
    entries: entries.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name)),
    perDay: Array.from(perDayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    ranking: Array.from(rankingMap.values())
      .sort((a, b) => b.faltas + b.atestados - (a.faltas + a.atestados) || a.name.localeCompare(b.name))
      .slice(0, 15),
    history,
  };
}
