import "server-only";
import { hasPermission, type CurrentUser } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { getExpiringQualifications } from "@/server/services/qualification.service";
import { getTimeClockReport, getChecklistAdherence } from "@/server/services/time-clock.service";
import { parseDateOnly } from "@/lib/dates";

const QUALIFICATION_HORIZON_DAYS = 30;
const OCCURRENCE_LOOKBACK_DAYS = 30;

export type AlertCategory = "QUALIFICACAO_VENCIDA" | "QUALIFICACAO_VENCENDO" | "FALTA" | "CHECKLIST_PENDENTE";

export type AlertItem = {
  id: string;
  category: AlertCategory;
  label: string;
  detail: string;
  href: string;
  date: Date;
};

export type AlertsSummary = {
  items: AlertItem[];
  count: number;
};

/**
 * Junta, num só lugar, o que já é calculado espalhado pelo sistema mas que hoje só aparece se
 * alguém for procurar: qualificação vencida/vencendo, falta não justificada e checklist pendente
 * não justificado. Cada seção só entra se o usuário tem a permissão daquele domínio — o sino não
 * deve mostrar nada que a pessoa não teria acesso de ver na tela de origem.
 */
const ALERTS_TTL_MS = 60_000;
const alertsCache = new Map<string, { at: number; value: AlertsSummary }>();

/** O sino vive no layout, então era recalculado a cada navegação (pra admin: qualificações + ponto de
 * 30 dias + aderência de checklist). Um minuto de cache por usuário tira isso do caminho de cada clique
 * sem deixar o número desatualizado de forma que importe. */
export async function getAlertsSummary(user: CurrentUser): Promise<AlertsSummary> {
  const cached = alertsCache.get(user.id);
  if (cached && Date.now() - cached.at < ALERTS_TTL_MS) return cached.value;
  const value = await computeAlertsSummary(user);
  alertsCache.set(user.id, { at: Date.now(), value });
  return value;
}

async function computeAlertsSummary(user: CurrentUser): Promise<AlertsSummary> {
  const items: AlertItem[] = [];

  if (hasPermission(user, PERMISSIONS.QUALIFICATION_MANAGE)) {
    const { expired, expiringSoon } = await getExpiringQualifications(user, QUALIFICATION_HORIZON_DAYS);
    for (const r of expired) {
      items.push({
        id: `qual-vencida-${r.id}`,
        category: "QUALIFICACAO_VENCIDA",
        label: `${r.collaborator.name} — ${r.qualificationType.name} vencida`,
        detail: `Venceu em ${r.expiresAt!.toLocaleDateString("pt-BR")}`,
        href: `/colaboradores/${r.collaboratorId}`,
        date: r.expiresAt!,
      });
    }
    for (const r of expiringSoon) {
      items.push({
        id: `qual-vencendo-${r.id}`,
        category: "QUALIFICACAO_VENCENDO",
        label: `${r.collaborator.name} — ${r.qualificationType.name} vencendo`,
        detail: `Vence em ${r.expiresAt!.toLocaleDateString("pt-BR")}`,
        href: `/colaboradores/${r.collaboratorId}`,
        date: r.expiresAt!,
      });
    }
  }

  const canSeeOccurrences = hasPermission(user, PERMISSIONS.HR_MANAGE) || hasPermission(user, PERMISSIONS.INDICATORS_VIEW_AREA);
  if (canSeeOccurrences) {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - OCCURRENCE_LOOKBACK_DAYS);

    if (hasPermission(user, PERMISSIONS.HR_MANAGE)) {
      const anomalies = await getTimeClockReport(user, { from, to });
      for (const a of anomalies) {
        if (a.type !== "FALTA") continue;
        items.push({
          id: `falta-${a.collaboratorId}-${a.date}`,
          category: "FALTA",
          label: `${a.collaboratorName} — falta não justificada`,
          detail: a.detail,
          href: "/rh/tratativa-ponto",
          date: parseDateOnly(a.date),
        });
      }
    }

    const adherence = await getChecklistAdherence(user, { from, to });
    for (const d of adherence.pendingDays) {
      if (d.justification) continue;
      items.push({
        id: `checklist-${d.collaboratorId}-${d.date}`,
        category: "CHECKLIST_PENDENTE",
        label: `${d.collaboratorName} — checklist pendente`,
        detail: d.detail,
        // A tratativa de ponto exige RH; quem só acompanha indicadores (gestor, auditor) vai pro painel.
        href: hasPermission(user, PERMISSIONS.HR_MANAGE) ? "/rh/tratativa-ponto" : "/indicadores",
        date: parseDateOnly(d.date),
      });
    }
  }

  items.sort((a, b) => b.date.getTime() - a.date.getTime());

  return { items, count: items.length };
}
