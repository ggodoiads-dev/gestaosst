import "server-only";
import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/server/db";
import { APP_TIMEZONE } from "@/lib/dates";
import { DTO_INCIDENT_TYPES, DTO_NEW_HIRE_DAYS } from "@/domain/dto/suggestions";
import { parseDreKey } from "@/domain/dre/metrics";
import { resolveDreMetric } from "@/server/services/dre.service";
import { parseTmaKey } from "@/domain/tma/stats";
import { resolveTmaMetric } from "@/server/services/tma.service";

/**
 * Números que o SIGO já mede sozinho e que alimentam os nós do cascateamento (`sigoKey`). Cada chave devolve o valor do
 * período (AAAA-MM) ou `null` quando não há como calcular (sem base). Chaves com ":" levam um parâmetro (turno, equipamento).
 */

const UNAVAILABLE = ["BLOQUEADO", "EM_MANUTENCAO"] as const;

export const SIGO_KEY_LABELS: Record<string, string> = {
  "dto.year.count": "DTOs feitos no ano (importados do DMPeople)",
  "dto.month.count": "DTOs feitos no mês",
  "dto.last7.count": "DTOs feitos nos últimos 7 dias",
  "dto.newhires.pct": "% dos novatos (menos de 60 dias de casa) com DTO",
  "dto.coverage60.pct": "% dos avaliados com DTO ou justificativa nos últimos 60 dias",
  "dto.incident.pct": "% dos incidentes recentes com DTO pós-incidente",
  "guardian.reporters.pct": "% dos colaboradores ativos que relataram no mês (Guardian)",
  "guardian.reports.count": "Relatos do Guardian no mês",
  "guardian.reports.ytd": "Relatos do Guardian no ano (até o mês)",
  "guardian.notreported.count": "Colaboradores ativos sem relato no mês",
  "guardian.notreported.turno": "Colaboradores do turno sem relato no mês",
  "forklift.checklist.pct": "% de empilhadeira-dia com checklist concluído no mês",
  "forklift.checklist.eq": "% dos dias do mês com checklist concluído nesta empilhadeira",
  "forklift.available.pct": "% das empilhadeiras liberadas (não bloqueadas nem em manutenção)",
};

function monthBounds(periodKey: string) {
  const [y, m] = periodKey.split("-").map(Number);
  return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)), y, m };
}

const pct = (part: number, total: number) => (total === 0 ? null : Math.round((part / total) * 10000) / 100);

async function dtoCollaborators() {
  return db.collaborator.findMany({
    where: { active: true, OR: [{ functionId: null }, { function: { dtoExempt: false } }] },
    select: { id: true, admissionDate: true },
  });
}

async function resolveOne(key: string, periodKey: string, todayKey: string): Promise<number | null> {
  if (key.startsWith("dre.")) return resolveDreMetric(key, periodKey);
  if (key.startsWith("tma.")) return resolveTmaMetric(key, periodKey);
  const [base, param] = key.split(":");
  const { from, to, y } = monthBounds(periodKey);
  const today = new Date(`${todayKey}T12:00:00Z`);

  switch (base) {
    case "dto.year.count":
      return db.dtoEvaluation.count({ where: { date: { gte: new Date(Date.UTC(y, 0, 1)), lt: to } } });
    case "dto.month.count":
      return db.dtoEvaluation.count({ where: { date: { gte: from, lt: to } } });
    case "dto.last7.count":
      return db.dtoEvaluation.count({ where: { date: { gte: addDays(today, -7), lte: today } } });
    case "dto.newhires.pct": {
      const limit = addDays(today, -DTO_NEW_HIRE_DAYS);
      const newHires = (await dtoCollaborators()).filter((c) => c.admissionDate && c.admissionDate >= limit);
      if (newHires.length === 0) return null;
      const done = await db.dtoEvaluation.findMany({ where: { collaboratorId: { in: newHires.map((c) => c.id) } }, select: { collaboratorId: true }, distinct: ["collaboratorId"] });
      return pct(done.length, newHires.length);
    }
    case "dto.coverage60.pct": {
      const people = await dtoCollaborators();
      const since = addDays(today, -60);
      const [evals, justs] = await Promise.all([
        db.dtoEvaluation.findMany({ where: { date: { gte: since } }, select: { collaboratorId: true }, distinct: ["collaboratorId"] }),
        db.dtoJustification.findMany({ where: { date: { gte: since } }, select: { collaboratorId: true }, distinct: ["collaboratorId"] }).catch(() => [] as { collaboratorId: string }[]),
      ]);
      const covered = new Set([...evals, ...justs].map((r) => r.collaboratorId));
      return pct(people.filter((p) => covered.has(p.id)).length, people.length);
    }
    case "dto.incident.pct": {
      const since = addDays(today, -60);
      const incidents = await db.accidentInvolvement.findMany({
        where: { role: "VITIMA", accident: { status: { not: "CANCELADA" }, type: { in: [...DTO_INCIDENT_TYPES] }, date: { gte: since } } },
        select: { collaboratorId: true, accident: { select: { date: true } } },
      });
      if (incidents.length === 0) return null;
      const evals = await db.dtoEvaluation.findMany({ where: { collaboratorId: { in: incidents.map((i) => i.collaboratorId) } }, select: { collaboratorId: true, date: true } });
      const covered = incidents.filter((i) => evals.some((e) => e.collaboratorId === i.collaboratorId && e.date >= i.accident.date)).length;
      return pct(covered, incidents.length);
    }
    case "guardian.reporters.pct":
    case "guardian.notreported.count":
    case "guardian.notreported.turno": {
      const people = await db.collaborator.findMany({
        where: { active: true, ...(base === "guardian.notreported.turno" ? { turnoId: param } : {}) },
        select: { id: true },
      });
      if (people.length === 0) return null;
      const reports = await db.guardianReport.findMany({
        where: { occurredAt: { gte: from, lt: to }, reporterCollaboratorId: { in: people.map((p) => p.id) } },
        select: { reporterCollaboratorId: true },
        distinct: ["reporterCollaboratorId"],
      });
      return base === "guardian.reporters.pct" ? pct(reports.length, people.length) : people.length - reports.length;
    }
    case "guardian.reports.count":
      return db.guardianReport.count({ where: { occurredAt: { gte: from, lt: to } } });
    case "guardian.reports.ytd":
      return db.guardianReport.count({ where: { occurredAt: { gte: new Date(Date.UTC(y, 0, 1)), lt: to } } });
    case "forklift.available.pct": {
      const forklifts = await db.equipment.findMany({ where: { active: true, type: { name: { contains: "empilhadeira", mode: "insensitive" } } }, select: { status: true } });
      return pct(forklifts.filter((f) => !(UNAVAILABLE as readonly string[]).includes(f.status)).length, forklifts.length);
    }
    case "forklift.checklist.pct":
    case "forklift.checklist.eq": {
      const equipments = await db.equipment.findMany({
        where: {
          active: true,
          status: { notIn: [...UNAVAILABLE] },
          ...(param ? { id: param } : { type: { name: { contains: "empilhadeira", mode: "insensitive" } } }),
        },
        select: { id: true },
      });
      if (equipments.length === 0) return null;
      // Só dias fechados (até ontem) do mês.
      const [y2, m2] = periodKey.split("-").map(Number);
      const daysInMonth = new Date(y2, m2, 0).getDate();
      const yesterdayKey = formatInTimeZone(addDays(today, -1), APP_TIMEZONE, "yyyy-MM-dd");
      const lastDay = periodKey > yesterdayKey.slice(0, 7) ? 0 : periodKey === yesterdayKey.slice(0, 7) ? Number(yesterdayKey.slice(8, 10)) : daysInMonth;
      if (lastDay === 0) return null;
      const startInstant = new Date(`${periodKey}-01T00:00:00-03:00`);
      const endInstant = new Date(startInstant.getTime() + lastDay * 24 * 60 * 60 * 1000);
      const executions = await db.checklistExecution.findMany({
        where: { equipmentId: { in: equipments.map((e) => e.id) }, status: "CONCLUIDO", finishedAt: { gte: startInstant, lt: endInstant } },
        select: { equipmentId: true, finishedAt: true },
      });
      const pairs = new Set(executions.map((e) => `${e.equipmentId}|${formatInTimeZone(e.finishedAt!, APP_TIMEZONE, "yyyy-MM-dd")}`));
      return pct(pairs.size, equipments.length * lastDay);
    }
    default:
      return null;
  }
}

/** Chave que dá o ACUMULADO DO ANO (YTD) de quem tem um resultado do mês contável. Só vale para contagens (somam). */
export function ytdKeyOf(sigoKey: string): string | null {
  const tma = parseTmaKey(sigoKey);
  if (tma) return tma.ytd ? null : sigoKey.replace(/^tma\.(avg|ambev|atendimento|within3h|tmc|stage)/, "tma.$1.ytd");
  const dre = parseDreKey(sigoKey);
  if (dre) return dre.ytd ? null : sigoKey.replace(/^dre\.(avr|ratio):/, "dre.$1.ytd:");
  if (sigoKey === "dto.month.count") return "dto.year.count";
  if (sigoKey === "guardian.reports.count") return "guardian.reports.ytd";
  return null;
}

/** Resolve vários `sigoKey` de uma vez. Falha de uma chave não derruba as outras (vira `null`). */
export async function resolveAutoValues(keys: string[], periodKey: string): Promise<Map<string, number | null>> {
  const todayKey = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
  const unique = [...new Set(keys)];
  const entries = await Promise.all(
    unique.map(async (key) => {
      try {
        return [key, await resolveOne(key, periodKey, todayKey)] as const;
      } catch (error) {
        console.error("[cascade] falha ao calcular", key, error);
        return [key, null] as const;
      }
    }),
  );
  return new Map(entries);
}
