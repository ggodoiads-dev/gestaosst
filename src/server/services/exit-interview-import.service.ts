import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { INTERVIEW_FIELD_ALIASES, INTERVIEW_IMPORT_FIELDS, classifyExitReason, classifyExitReasons, parseRating, parseWouldReturn, type InterviewImportField, type InterviewImportMapping } from "@/domain/termination/interview-import";
import { EXIT_RATINGS, type ExitRatings } from "@/domain/termination/interview";
import { parseSpreadsheet, suggestMapping as suggestMappingGeneric, getCell, normalize, parseDateCell } from "@/lib/spreadsheet-import";

export type { InterviewImportField, InterviewImportMapping };
export { parseSpreadsheet };

const RH = PERMISSIONS.HR_MANAGE;

export function suggestMapping(headers: string[]): InterviewImportMapping {
  return suggestMappingGeneric(headers, INTERVIEW_IMPORT_FIELDS.map((f) => f.key), INTERVIEW_FIELD_ALIASES);
}

export type InterviewImportRow = {
  rowIndex: number;
  action: "create" | "update" | "skip" | "error";
  error?: string;
  skipReason?: string;
  name: string;
  terminationId: string | null;
  terminationDate: Date | null;
  interviewDate: Date | null;
  primaryReason: string | null;
  primaryText: string | null;
  secondaryReasons: string[];
  wouldReturn: string | null;
  destination: string | null;
  comments: string | null;
  interviewer: string | null;
  ratings: ExitRatings;
};

/** Casa cada entrevista com o desligamento já importado (matrícula, depois nome; se houver mais de um, o de data mais próxima). Não grava nada. */
export async function buildInterviewImportPreview(user: CurrentUser, rows: string[][], mapping: InterviewImportMapping): Promise<InterviewImportRow[]> {
  requirePermission(user, RH);
  const [terminations, interviewed] = await Promise.all([
    db.termination.findMany({ select: { id: true, name: true, matricula: true, terminationDate: true } }),
    db.exitInterview.findMany({ select: { terminationId: true } }).catch(() => [] as { terminationId: string }[]),
  ]);
  const has = new Set(interviewed.map((i) => i.terminationId));
  const byMatricula = new Map<string, typeof terminations>();
  const byName = new Map<string, typeof terminations>();
  for (const t of terminations) {
    if (t.matricula) byMatricula.set(normalize(t.matricula), [...(byMatricula.get(normalize(t.matricula)) ?? []), t]);
    byName.set(normalize(t.name), [...(byName.get(normalize(t.name)) ?? []), t]);
  }
  const closest = (list: typeof terminations | undefined, at: Date | null) => {
    if (!list || list.length === 0) return null;
    if (list.length === 1 || !at) return [...list].sort((a, b) => b.terminationDate.getTime() - a.terminationDate.getTime())[0];
    return [...list].sort((a, b) => Math.abs(a.terminationDate.getTime() - at.getTime()) - Math.abs(b.terminationDate.getTime() - at.getTime()))[0];
  };

  const seen = new Set<string>();
  return rows.map((row, rowIndex) => {
    const name = getCell(row, mapping, "name");
    const primaryText = getCell(row, mapping, "primaryReason");
    const interviewDate = parseDateCell(getCell(row, mapping, "interviewDate"));
    const secondaryText = getCell(row, mapping, "otherReasons");
    const ratings: ExitRatings = {};
    for (const r of EXIT_RATINGS) {
      const n = parseRating(getCell(row, mapping, r.key));
      if (n !== null) ratings[r.key] = n;
    }
    const primary = classifyExitReason(primaryText);
    const comments = [getCell(row, mapping, "comments"), primary === "OUTRO" ? primaryText : null].filter(Boolean).join(" — ") || null;
    const base = {
      rowIndex,
      name: name ?? "",
      terminationId: null as string | null,
      terminationDate: null as Date | null,
      interviewDate,
      primaryReason: primary,
      primaryText,
      secondaryReasons: [...new Set([...classifyExitReasons(secondaryText), ...classifyExitReasons(primaryText).slice(1)])].filter((k) => k !== primary).slice(0, 5),
      wouldReturn: parseWouldReturn(getCell(row, mapping, "wouldReturn")),
      destination: getCell(row, mapping, "destination"),
      comments,
      interviewer: getCell(row, mapping, "interviewer"),
      ratings,
    };
    if (!name && row.every((c) => !c || c.trim() === "")) return { ...base, action: "skip" as const, skipReason: "linha vazia" };
    if (!name) return { ...base, action: "error" as const, error: "Sem nome." };
    if (!primary) return { ...base, action: "error" as const, error: "Sem motivo principal." };
    const matricula = getCell(row, mapping, "matricula");
    const found = closest(matricula ? byMatricula.get(normalize(matricula)) : undefined, interviewDate) ?? closest(byName.get(normalize(name)), interviewDate);
    if (!found) return { ...base, action: "error" as const, error: "Desligamento não encontrado. Importe o desligamento desta pessoa primeiro." };
    if (seen.has(found.id)) return { ...base, terminationId: found.id, terminationDate: found.terminationDate, action: "skip" as const, skipReason: "outra linha do arquivo já traz a entrevista desta pessoa" };
    seen.add(found.id);
    return { ...base, terminationId: found.id, terminationDate: found.terminationDate, action: has.has(found.id) ? ("update" as const) : ("create" as const) };
  });
}

export async function commitInterviewImport(user: CurrentUser, rows: InterviewImportRow[]): Promise<{ created: number; updated: number; skipped: number; errors: number }> {
  requirePermission(user, RH);
  let created = 0;
  let updated = 0;
  for (const r of rows) {
    if ((r.action !== "create" && r.action !== "update") || !r.terminationId || !r.primaryReason) continue;
    const when = r.interviewDate ?? r.terminationDate ?? new Date();
    const data = {
      conductedAt: new Date(when.getFullYear(), when.getMonth(), when.getDate(), 12),
      interviewer: r.interviewer?.slice(0, 120) ?? null,
      primaryReason: r.primaryReason,
      secondaryReasons: r.secondaryReasons,
      ratings: r.ratings,
      wouldReturn: r.wouldReturn,
      destination: r.destination?.slice(0, 200) ?? null,
      comments: r.comments?.slice(0, 2000) ?? null,
    };
    await db.exitInterview.upsert({ where: { terminationId: r.terminationId }, update: data, create: { terminationId: r.terminationId, createdById: user.id, ...data } });
    if (r.action === "create") created++;
    else updated++;
  }
  await recordAudit({ userId: user.id, action: "CREATE", entityType: "ExitInterview", entityId: "import", newValue: { created, updated, rows: rows.length } });
  return { created, updated, skipped: rows.filter((r) => r.action === "skip").length, errors: rows.filter((r) => r.action === "error").length };
}
