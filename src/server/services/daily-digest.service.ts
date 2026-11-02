import "server-only";
import { db } from "@/server/db";
import { requirePermission, type CurrentUser } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { buildAlerts, type AlertInput, type SystemAlert } from "@/domain/alerts/rules";

const CLOSED_NC = ["CONCLUIDA", "ENCERRADA", "CANCELADA"] as const;
const INJURY_TYPES = ["ACIDENTE_TIPICO", "ACIDENTE_TRAJETO", "FAI", "DOENCA_OCUPACIONAL"] as const;
const DAY = 86400000;

/** Números que alimentam as regras de aviso. Sem usuário: serve a página e a rotina diária de envio. */
export async function collectAlertInput(now: Date = new Date()): Promise<AlertInput> {
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY);
  const since48h = new Date(now.getTime() - 2 * DAY);
  const [records, criticalOpen, highOpenOver7Days, overdue, accidents, overdueActions] = await Promise.all([
    db.qualificationRecord.findMany({
      where: { collaborator: { active: true } },
      orderBy: { completedDate: "desc" },
      select: { collaboratorId: true, qualificationTypeId: true, expiresAt: true, qualificationType: { select: { category: true } } },
    }),
    db.nonconformity.count({ where: { severity: "CRITICA", status: { notIn: [...CLOSED_NC] } } }),
    db.nonconformity.count({ where: { severity: "ALTA", status: { notIn: [...CLOSED_NC] }, identifiedAt: { lt: sevenDaysAgo } } }),
    db.nonconformity.count({ where: { status: { notIn: [...CLOSED_NC] }, dueDate: { lt: now } } }),
    db.accident.findMany({ where: { reportedAt: { gte: since48h }, status: { not: "CANCELADA" } }, select: { code: true, type: true, isSif: true } }),
    db.actionItem.count({ where: { dueDate: { lt: now }, status: { in: ["PENDENTE", "EM_ANDAMENTO"] } } }),
  ]);

  // Só o registro mais recente de cada pessoa em cada tipo conta.
  const seen = new Set<string>();
  let asoExpired = 0;
  let otherExpired = 0;
  let expiring30 = 0;
  let asoExpiring30 = 0;
  for (const r of records) {
    const key = `${r.collaboratorId}|${r.qualificationTypeId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!r.expiresAt) continue;
    const days = Math.ceil((r.expiresAt.getTime() - now.getTime()) / DAY);
    const isAso = r.qualificationType.category === "ASO";
    if (days < 0) {
      if (isAso) asoExpired++;
      else otherExpired++;
    } else if (days <= 30) {
      expiring30++;
      if (isAso) asoExpiring30++;
    }
  }

  const grave = accidents.filter((a) => a.isSif || (INJURY_TYPES as readonly string[]).includes(a.type));
  return {
    qualifications: { asoExpired, otherExpired, expiring30, asoExpiring30 },
    nonconformities: { criticalOpen, highOpenOver7Days, overdue },
    recentAccidents: { total: accidents.length, withInjuryOrSif: grave.length, codes: grave.map((a) => a.code) },
    overdueActions,
  };
}

export async function listAlerts(): Promise<SystemAlert[]> {
  return buildAlerts(await collectAlertInput());
}

/** Página de avisos: mesmo critério do consolidado. */
export async function listAlertsForUser(user: CurrentUser): Promise<SystemAlert[]> {
  requirePermission(user, PERMISSIONS.INDICATORS_VIEW_CONSOLIDATED);
  return listAlerts();
}

/** Envia o e-mail pelo Resend (https://resend.com). Sem `RESEND_API_KEY` e `ALERTS_FROM` configurados, não envia e diz por quê. */
export async function sendEmail(input: { to: string[]; subject: string; text: string; html: string }): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.ALERTS_FROM;
  if (!key || !from) return { sent: false, reason: "RESEND_API_KEY ou ALERTS_FROM não configurados" };
  if (input.to.length === 0) return { sent: false, reason: "ALERTS_TO vazio (ninguém para receber)" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: input.to, subject: input.subject, text: input.text, html: input.html }),
  });
  if (!res.ok) return { sent: false, reason: `Resend respondeu ${res.status}` };
  return { sent: true };
}
