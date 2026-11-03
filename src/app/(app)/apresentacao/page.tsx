import { requireUser } from "@/server/auth/current-user";
import { getYesterdayStory } from "@/server/services/day-story.service";
import { loadHomeNovoProps } from "../inicio/load-home-data";
import { Presentation } from "./presentation";

/** Apresentação em 3D conduzida pelo scroll (versão de teste, separada do dashboard e do login). */
export default async function ApresentacaoPage() {
  const user = await requireUser();
  const d = await loadHomeNovoProps(user);
  const story = await getYesterdayStory(user);
  const kpis: { label: string; value: string; unit?: string; note?: string }[] = [];
  if (d.checklistPct !== null) kpis.push({ label: "Aderência de checklist", value: String(d.checklistPct), unit: "%", note: "Último dia fechado" });
  if (d.turnover && d.turnover.rate !== null) kpis.push({ label: "Turnover 12 meses", value: String(d.turnover.rate).replace(".", ","), unit: "%", note: d.turnover.goal !== null ? `Meta do ano ${String(d.turnover.goal).replace(".", ",")}%` : undefined });
  if (d.ncAbertas !== null) kpis.push({ label: "NCs abertas", value: String(d.ncAbertas).padStart(2, "0") });
  if (d.equipamentosBloqueados !== null) kpis.push({ label: "Equip. bloqueados", value: String(d.equipamentosBloqueados).padStart(2, "0") });
  if (kpis.length === 0) kpis.push({ label: "Seu checklist hoje", value: `${d.meuChecklist.realizados}/${d.meuChecklist.previstos}`, note: d.meuChecklist.atrasados > 0 ? `${d.meuChecklist.atrasados} atrasado(s)` : "Nada atrasado" });
  return (
    <Presentation
      firstName={d.firstName}
      dateLabel={d.dateLabel}
      alerts={d.alerts.map((a) => ({ key: a.key, title: a.title, severity: a.severity, href: a.href }))}
      kpis={kpis}
      panelHref="/painel"
      story={story}
    />
  );
}
