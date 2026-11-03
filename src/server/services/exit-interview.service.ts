import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { isExitReason, sanitizeRatings, WOULD_RETURN, type ExitRatings } from "@/domain/termination/interview";

const RH = PERMISSIONS.HR_MANAGE;

export type ExitInterviewData = {
  conductedAt: string; // AAAA-MM-DD
  interviewer: string;
  primaryReason: string;
  secondaryReasons: string[];
  ratings: ExitRatings;
  wouldReturn: string;
  destination: string;
  comments: string;
};

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export async function getExitInterview(user: CurrentUser, terminationId: string): Promise<ExitInterviewData | null> {
  requirePermission(user, RH);
  try {
    const row = await db.exitInterview.findUnique({ where: { terminationId } });
    if (!row) return null;
    return {
      conductedAt: dayKey(row.conductedAt),
      interviewer: row.interviewer ?? "",
      primaryReason: row.primaryReason,
      secondaryReasons: Array.isArray(row.secondaryReasons) ? (row.secondaryReasons as unknown[]).filter((k): k is string => typeof k === "string") : [],
      ratings: sanitizeRatings(row.ratings),
      wouldReturn: row.wouldReturn ?? "",
      destination: row.destination ?? "",
      comments: row.comments ?? "",
    };
  } catch (error) {
    console.error("[exit-interview] tabela indisponível:", error);
    return null;
  }
}

/** Ids dos desligamentos que já têm entrevista (para a lista mostrar o que falta). Tolerante: sem a tabela, ninguém tem. */
export async function listInterviewedTerminationIds(): Promise<Set<string>> {
  try {
    return new Set((await db.exitInterview.findMany({ select: { terminationId: true } })).map((r) => r.terminationId));
  } catch (error) {
    console.error("[exit-interview] tabela indisponível:", error);
    return new Set();
  }
}

export async function saveExitInterview(user: CurrentUser, terminationId: string, input: ExitInterviewData) {
  requirePermission(user, RH);
  const termination = await db.termination.findUnique({ where: { id: terminationId }, select: { id: true, name: true } });
  if (!termination) throw new Error("Desligamento não encontrado.");
  if (!isExitReason(input.primaryReason)) throw new Error("Escolha o motivo principal.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.conductedAt)) throw new Error("Informe a data da entrevista.");
  const secondary = [...new Set(input.secondaryReasons.filter(isExitReason).filter((k) => k !== input.primaryReason))].slice(0, 5);
  const wouldReturn = WOULD_RETURN.some((w) => w.key === input.wouldReturn) ? input.wouldReturn : null;
  const data = {
    conductedAt: new Date(`${input.conductedAt}T12:00:00-03:00`),
    interviewer: input.interviewer.trim().slice(0, 120) || null,
    primaryReason: input.primaryReason,
    secondaryReasons: secondary,
    ratings: sanitizeRatings(input.ratings),
    wouldReturn,
    destination: input.destination.trim().slice(0, 200) || null,
    comments: input.comments.trim().slice(0, 2000) || null,
  };
  await db.exitInterview.upsert({ where: { terminationId }, update: data, create: { terminationId, createdById: user.id, ...data } });
  await recordAudit({ userId: user.id, action: "UPDATE", entityType: "ExitInterview", entityId: terminationId, newValue: { primaryReason: data.primaryReason, secondary: secondary.length } });
}

/** Efetivo oficial por mês (AAAA-MM → pessoas). Tolerante: sem a tabela, vale a estimativa do cadastro. */
export async function loadHeadcountBase(): Promise<Map<string, number>> {
  try {
    return new Map((await db.turnoverHeadcount.findMany()).map((r) => [r.month, r.headcount]));
  } catch (error) {
    console.error("[turnover] base de efetivo indisponível:", error);
    return new Map();
  }
}

export async function saveHeadcountBase(user: CurrentUser, entries: { month: string; headcount: number | null }[]) {
  requirePermission(user, RH);
  const valid = entries.filter((e) => /^\d{4}-(0[1-9]|1[0-2])$/.test(e.month));
  for (const e of valid) {
    if (e.headcount === null || !Number.isFinite(e.headcount) || e.headcount <= 0) {
      await db.turnoverHeadcount.deleteMany({ where: { month: e.month } });
    } else {
      const headcount = Math.min(Math.round(e.headcount), 100000);
      await db.turnoverHeadcount.upsert({ where: { month: e.month }, update: { headcount, updatedById: user.id }, create: { month: e.month, headcount, updatedById: user.id } });
    }
  }
  await recordAudit({ userId: user.id, action: "UPDATE", entityType: "TurnoverHeadcount", entityId: "base", newValue: { months: valid.length } });
}
