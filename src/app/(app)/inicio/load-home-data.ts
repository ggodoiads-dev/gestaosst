import "server-only";
import { hasPermission, type CurrentUser } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { getColaboradorSummary, getGestaoSummary } from "@/server/services/indicators.service";
import { getChecklistComplianceDashboard, compliancePercent } from "@/server/services/checklist-compliance.service";
import { listAlerts } from "@/server/services/daily-digest.service";
import { getPdcaView } from "@/server/services/pdca.service";
import { getNavGroups } from "@/components/layout/nav-items";
import { getUserNavWhitelist } from "@/server/services/nav-access.service";
import { filterNavGroups } from "@/domain/shared/nav-access";
import { formatLongDate } from "@/lib/dates";
import type { HomeNovoProps } from "./home-novo";

/** Atalhos do menu (até 8) que a pessoa pode abrir, respeitando o acesso restrito por abas. */
export async function loadQuickLinks(user: CurrentUser): Promise<{ href: string; label: string }[]> {
  const whitelist = await getUserNavWhitelist(user);
  const groups = whitelist ? filterNavGroups(getNavGroups(user), new Set(whitelist)) : getNavGroups(user);
  return groups
    .flatMap((g) => g.items)
    .filter((i) => i.href !== "/inicio")
    .slice(0, 8)
    .map((i) => ({ href: i.href, label: i.label }));
}

/** Dados da tela inicial e do painel do visual novo. Cada bloco só entra se a pessoa tem a permissão (e a aba, no acesso restrito). */
export async function loadHomeNovoProps(user: CurrentUser): Promise<HomeNovoProps> {
  const whitelist = await getUserNavWhitelist(user);
  const allowedSet = whitelist ? new Set(whitelist) : null;
  const allow = (href: string) => !allowedSet || allowedSet.has(href);

  const canSeeGestao =
    (hasPermission(user, PERMISSIONS.INDICATORS_VIEW_AREA) || hasPermission(user, PERMISSIONS.INDICATORS_VIEW_CONSOLIDATED)) && allow("/indicadores");
  const canSeeConsolidated = hasPermission(user, PERMISSIONS.INDICATORS_VIEW_CONSOLIDATED) && allow("/indicadores");
  const canSeeHr = hasPermission(user, PERMISSIONS.HR_MANAGE);
  const canSeeChecklistCompliance = hasPermission(user, PERMISSIONS.CHECKLIST_COMPLIANCE_VIEW) && allow("/indicadores");

  const [colaboradorSummary, gestaoSummary, checklist, alerts, pdca] = await Promise.all([
    getColaboradorSummary(user),
    canSeeGestao ? getGestaoSummary(user) : Promise.resolve(null),
    canSeeChecklistCompliance ? getChecklistComplianceDashboard(user).catch(() => null) : Promise.resolve(null),
    canSeeConsolidated ? listAlerts().catch(() => []) : Promise.resolve([]),
    canSeeHr && allow("/desligamentos") ? getPdcaView(user, new Date().getFullYear()).catch(() => null) : Promise.resolve(null),
  ]);

  const checklistPct = checklist ? compliancePercent(checklist.today) : null;
  const turnoverRate = pdca?.current?.rate ?? null;
  const turnoverGoal = pdca?.data.annualGoal ?? null;
  const navGroups = allowedSet ? filterNavGroups(getNavGroups(user), allowedSet) : getNavGroups(user);

  return {
    firstName: user.name.split(" ")[0],
    dateLabel: formatLongDate(new Date()),
    alerts,
    checklistPct,
    turnover: turnoverRate !== null ? { rate: turnoverRate, goal: turnoverGoal } : null,
    ncAbertas: gestaoSummary?.ncAbertas ?? null,
    equipamentosBloqueados: gestaoSummary?.equipamentosBloqueados ?? null,
    meuChecklist: { previstos: colaboradorSummary.previstos, realizados: colaboradorSummary.realizados, atrasados: colaboradorSummary.atrasados },
    quickLinks: navGroups
      .flatMap((g) => g.items)
      .filter((i) => i.href !== "/inicio")
      .slice(0, 8)
      .map((i) => ({ href: i.href, label: i.label })),
    featured:
      turnoverRate !== null
        ? { id: "turnover", label: "Turnover 12 meses", value: String(turnoverRate).replace(".", ","), unit: "%", note: turnoverGoal !== null ? `Meta do ano ${String(turnoverGoal).replace(".", ",")}%. Abrir o PDCA do turnover.` : "Abrir o PDCA do turnover.", href: "/desligamentos/pdca" }
        : checklistPct !== null
          ? { id: "checklist", label: "Aderência de checklist", value: String(checklistPct), unit: "%", note: "Último dia fechado. Abrir os indicadores.", href: "/indicadores" }
          : null,
  };
}
