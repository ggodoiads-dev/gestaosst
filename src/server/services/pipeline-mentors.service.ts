import "server-only";
import { subMonths } from "date-fns";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { isPadrinhoQualification } from "@/domain/qualification/padrinho";
import { monthsBetween, iccLabel } from "@/domain/pipeline/rules";
import { ADHERENCE_LABEL, adherence, adherenceLevel } from "@/domain/pipeline/matrix";

const fold = (s: string) =>
  Array.from(s.normalize("NFD"))
    .filter((ch) => ch.codePointAt(0)! < 0x300)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export type MentorRow = {
  collaboratorId: string;
  name: string;
  functionName: string | null;
  certifiedAt: Date;
  admissionDate: Date | null;
  tenureMonths: number | null;
  cycle: string | null;
  safetyOccurrences: number;
  absences: number;
  matrix: { name: string; pct: number; level: string } | null;
  plan: { skill: string | null; action: string | null; status: string | null; dueDate: Date | null; dueNote: string | null } | null;
  /** Motivos de atenção (vazio = apto). */
  flags: string[];
};

export type MentorsView = {
  ready: boolean;
  year: number;
  mentors: MentorRow[];
  /** Nomes marcados como Padrinho na matriz ou nos especialistas que não têm a trilha de Padrinho cadastrada. */
  withoutCertificate: { name: string; where: string }[];
};

/**
 * Mentores (padrinhos): quem fez a Trilha de Treinamento para Padrinhos (cadastro de qualificações), com os critérios da planilha de gestão — tempo de casa,
 * Ciclo de Gente, ocorrência de segurança e falta nos últimos 12 meses — e o que o Pipeline já sabe deles (aderência na matriz e plano de desenvolvimento).
 */
export async function getMentorsView(user: CurrentUser, year: number): Promise<MentorsView> {
  requirePermission(user, PERMISSIONS.HR_MANAGE);
  const now = new Date();
  const since = subMonths(now, 12);

  const records = await db.qualificationRecord.findMany({
    where: { qualificationType: { name: { contains: "padrinho", mode: "insensitive" } }, collaborator: { active: true } },
    include: { qualificationType: { select: { name: true } }, collaborator: { select: { id: true, name: true, admissionDate: true, function: { select: { name: true } } } } },
    orderBy: { completedDate: "desc" },
  });
  const certified = new Map<string, (typeof records)[number]>();
  for (const r of records) if (isPadrinhoQualification(r.qualificationType.name) && !certified.has(r.collaboratorId)) certified.set(r.collaboratorId, r);
  const ids = [...certified.keys()];

  const [accidents, absences] = await Promise.all([
    ids.length ? db.accidentInvolvement.groupBy({ by: ["collaboratorId"], where: { collaboratorId: { in: ids }, role: "VITIMA", accident: { status: { not: "CANCELADA" }, date: { gte: since } } }, _count: { _all: true } }) : Promise.resolve([]),
    ids.length ? db.scheduleDayNote.groupBy({ by: ["collaboratorId"], where: { collaboratorId: { in: ids }, status: "FALTA", date: { gte: since } }, _count: { _all: true } }) : Promise.resolve([]),
  ]);
  const accidentBy = new Map(accidents.map((a) => [a.collaboratorId, a._count._all]));
  const absenceBy = new Map(absences.map((a) => [a.collaboratorId, a._count._all]));

  // O que o Pipeline já tem: Ciclo de Gente, matrizes e plano dos especialistas (tolerante: sem as tabelas, vem vazio).
  let cycleRows: { collaboratorId: string | null; name: string; iccResult: string | null }[] = [];
  let matrices: { name: string; skillIds: string[]; members: { collaboratorId: string | null; name: string; grp: string | null; levels: Map<string, number> }[] }[] = [];
  let specialists: { collaboratorId: string | null; name: string; grp: string; skill: string | null; action: string | null; status: string | null; dueDate: Date | null; dueNote: string | null }[] = [];
  let ready = true;
  try {
    const [cycles, mats, specs] = await Promise.all([
      db.peopleCycleEntry.findMany({ where: { cycleYear: year }, select: { collaboratorId: true, name: true, iccResult: true } }),
      db.skillMatrix.findMany({ include: { skills: { select: { id: true } }, members: { include: { levels: true } } }, orderBy: { sortOrder: "asc" } }),
      db.functionSpecialist.findMany({ where: { grp: { equals: "Padrinho", mode: "insensitive" } } }),
    ]);
    cycleRows = cycles;
    matrices = mats.map((m) => ({ name: m.name, skillIds: m.skills.map((s) => s.id), members: m.members.map((x) => ({ collaboratorId: x.collaboratorId, name: x.name, grp: x.grp, levels: new Map(x.levels.map((l) => [l.skillId, l.level])) })) }));
    specialists = specs;
  } catch (error) {
    console.error("[mentores] tabelas do Pipeline indisponíveis:", error);
    ready = false;
  }

  const sameperson = (a: { collaboratorId: string | null; name: string }, id: string, name: string) => (a.collaboratorId ? a.collaboratorId === id : fold(a.name) === fold(name));

  const mentors: MentorRow[] = [...certified.values()]
    .map((r) => {
      const c = r.collaborator;
      const cycle = cycleRows.find((e) => sameperson(e, c.id, c.name));
      let matrix: MentorRow["matrix"] = null;
      for (const m of matrices) {
        const member = m.members.find((x) => sameperson(x, c.id, c.name));
        if (!member) continue;
        const value = adherence(m.skillIds.map((id) => member.levels.get(id)));
        const level = adherenceLevel(value);
        if (value !== null && level) {
          matrix = { name: m.name, pct: Math.round(value * 100), level: ADHERENCE_LABEL[level] };
          break;
        }
      }
      const plan = specialists.find((s) => sameperson(s, c.id, c.name));
      const tenureMonths = c.admissionDate ? monthsBetween(c.admissionDate, now) : null;
      const safety = accidentBy.get(c.id) ?? 0;
      const faltas = absenceBy.get(c.id) ?? 0;
      const flags: string[] = [];
      if (safety > 0) flags.push(`${safety} ocorrência(s) de segurança em 12 meses`);
      if (faltas > 0) flags.push(`${faltas} falta(s) em 12 meses`);
      return {
        collaboratorId: c.id,
        name: c.name,
        functionName: c.function?.name ?? null,
        certifiedAt: r.completedDate,
        admissionDate: c.admissionDate,
        tenureMonths,
        cycle: cycle ? iccLabel(cycle.iccResult) : null,
        safetyOccurrences: safety,
        absences: faltas,
        matrix,
        plan: plan ? { skill: plan.skill, action: plan.action, status: plan.status, dueDate: plan.dueDate, dueNote: plan.dueNote } : null,
        flags,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // Indicados como Padrinho no Pipeline que não têm a trilha cadastrada.
  const certifiedNames = new Set(mentors.map((m) => fold(m.name)));
  const certifiedIds = new Set(ids);
  const withoutCertificate: MentorsView["withoutCertificate"] = [];
  const seen = new Set<string>();
  const consider = (name: string, collaboratorId: string | null, where: string) => {
    const key = fold(name);
    if (seen.has(key) || (collaboratorId && certifiedIds.has(collaboratorId)) || certifiedNames.has(key)) return;
    seen.add(key);
    withoutCertificate.push({ name, where });
  };
  for (const s of specialists) consider(s.name, s.collaboratorId, "Especialistas de função");
  for (const m of matrices) for (const x of m.members) if (x.grp && fold(x.grp) === "padrinho") consider(x.name, x.collaboratorId, `Matriz ${m.name}`);

  return { ready, year, mentors, withoutCertificate };
}
