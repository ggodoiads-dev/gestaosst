import { requireUser } from "@/server/auth/current-user";
import { getYesterdayStory } from "@/server/services/day-story.service";
import { Cinema } from "./cinema";
import { loadHomeNovoProps } from "./load-home-data";

export default async function InicioPage() {
  const user = await requireUser();
  const d = await loadHomeNovoProps(user);
  const kpis: { label: string; value: string; unit?: string; note?: string }[] = [];
  if (d.checklistPct !== null) kpis.push({ label: "Aderência de checklist", value: String(d.checklistPct), unit: "%", note: "Último dia fechado" });
  if (d.turnover && d.turnover.rate !== null) kpis.push({ label: "Turnover do ano", value: String(d.turnover.rate).replace(".", ","), unit: "%", note: d.turnover.goal !== null ? `Meta do ano ${String(d.turnover.goal).replace(".", ",")}%` : undefined });
  if (d.ncAbertas !== null) kpis.push({ label: "NCs abertas", value: String(d.ncAbertas).padStart(2, "0") });
  if (d.equipamentosBloqueados !== null) kpis.push({ label: "Equip. bloqueados", value: String(d.equipamentosBloqueados).padStart(2, "0") });
  if (kpis.length === 0) kpis.push({ label: "Seu checklist hoje", value: `${d.meuChecklist.realizados}/${d.meuChecklist.previstos}`, note: d.meuChecklist.atrasados > 0 ? `${d.meuChecklist.atrasados} atrasado(s)` : "Nada atrasado" });
  const story = await getYesterdayStory(user);
  return (
    <div className="relative">
      <Cinema
        story={story}
        firstName={d.firstName}
        dateLabel={d.dateLabel}
        alerts={d.alerts.map((a) => ({ key: a.key, title: a.title, severity: a.severity, href: a.href }))}
        kpis={kpis}
        panelHref="/painel"
      />
    </div>
  );
}
