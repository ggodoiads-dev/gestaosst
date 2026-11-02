/**
 * Avisos automáticos do SIGO: o que precisa de atenção hoje, calculado por regras fixas sobre números do sistema.
 * Nenhuma regra usa IA. O resumo diário (e-mail e página /avisos) é montado a partir desta lista.
 */

export type AlertSeverity = "CRITICO" | "ALTO" | "ATENCAO";

export type SystemAlert = {
  key: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  /** Caminho no SIGO onde o problema se resolve. */
  href: string;
};

export type AlertInput = {
  /** Qualificações vencidas e a vencer (registro mais recente de cada pessoa e tipo). */
  qualifications: { asoExpired: number; otherExpired: number; expiring30: number; asoExpiring30: number };
  /** Não conformidades abertas. */
  nonconformities: { criticalOpen: number; highOpenOver7Days: number; overdue: number };
  /** Acidentes e ocorrências registrados nas últimas 48 horas. */
  recentAccidents: { total: number; withInjuryOrSif: number; codes: string[] };
  /** Ações de plano de ação com prazo vencido e sem conclusão. */
  overdueActions: number;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function buildAlerts(i: AlertInput): SystemAlert[] {
  const out: SystemAlert[] = [];
  const q = i.qualifications;
  if (q.asoExpired > 0) {
    out.push({ key: "aso-vencido", severity: "CRITICO", title: plural(q.asoExpired, "ASO vencido", "ASOs vencidos"), detail: "Colaborador sem exame ocupacional válido não deve exercer a função.", href: "/relatorios?tipo=qualificacoes" });
  }
  if (i.recentAccidents.withInjuryOrSif > 0) {
    out.push({ key: "acidente-grave", severity: "CRITICO", title: plural(i.recentAccidents.withInjuryOrSif, "ocorrência com lesão ou potencial SIF", "ocorrências com lesão ou potencial SIF") + " nas últimas 48 horas", detail: i.recentAccidents.codes.length ? `Códigos: ${i.recentAccidents.codes.slice(0, 5).join(", ")}.` : "Abrir a investigação.", href: "/acidentes" });
  } else if (i.recentAccidents.total > 0) {
    out.push({ key: "acidente-recente", severity: "ATENCAO", title: plural(i.recentAccidents.total, "ocorrência registrada", "ocorrências registradas") + " nas últimas 48 horas", detail: "Sem lesão nem potencial SIF informado.", href: "/acidentes" });
  }
  if (i.nonconformities.criticalOpen > 0) {
    out.push({ key: "nc-critica", severity: "CRITICO", title: plural(i.nonconformities.criticalOpen, "não conformidade crítica aberta", "não conformidades críticas abertas"), detail: "Severidade crítica ainda sem conclusão.", href: "/nao-conformidades?severity=CRITICA" });
  }
  if (q.otherExpired > 0) {
    out.push({ key: "qualificacao-vencida", severity: "ALTO", title: plural(q.otherExpired, "NR, integração ou outra qualificação vencida", "NRs, integrações ou outras qualificações vencidas"), detail: "Treinamento com validade expirada.", href: "/relatorios?tipo=qualificacoes" });
  }
  if (i.nonconformities.highOpenOver7Days > 0) {
    out.push({ key: "nc-alta-parada", severity: "ALTO", title: plural(i.nonconformities.highOpenOver7Days, "não conformidade de severidade alta aberta há mais de 7 dias", "não conformidades de severidade alta abertas há mais de 7 dias"), detail: "Sem avanço na semana.", href: "/nao-conformidades?severity=ALTA" });
  }
  if (i.nonconformities.overdue > 0) {
    out.push({ key: "nc-vencida", severity: "ALTO", title: plural(i.nonconformities.overdue, "não conformidade com prazo vencido", "não conformidades com prazo vencido"), detail: "Prazo passou e ela segue aberta.", href: "/nao-conformidades?overdue=true" });
  }
  if (i.overdueActions > 0) {
    out.push({ key: "acao-vencida", severity: "ALTO", title: plural(i.overdueActions, "ação de plano de ação vencida", "ações de plano de ação vencidas"), detail: "Prazo da ação passou sem conclusão.", href: "/nao-conformidades?overdue=true" });
  }
  if (q.expiring30 > 0) {
    const aso = q.asoExpiring30 > 0 ? ` (${q.asoExpiring30} ${q.asoExpiring30 === 1 ? "é ASO" : "são ASO"})` : "";
    out.push({ key: "vencendo-30", severity: "ATENCAO", title: `${plural(q.expiring30, "qualificação vence", "qualificações vencem")} em até 30 dias${aso}`, detail: "Janela curta para agendar a renovação.", href: "/relatorios?tipo=qualificacoes" });
  }
  const rank: Record<AlertSeverity, number> = { CRITICO: 0, ALTO: 1, ATENCAO: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

export const ALERT_SEVERITY_LABEL: Record<AlertSeverity, string> = { CRITICO: "Crítico", ALTO: "Alto", ATENCAO: "Atenção" };

/** Resumo em texto puro e HTML simples para e-mail. `baseUrl` sem barra final. */
export function renderDigest(alerts: SystemAlert[], baseUrl: string, dateLabel: string): { subject: string; text: string; html: string } {
  const critical = alerts.filter((a) => a.severity === "CRITICO").length;
  const subject = alerts.length === 0 ? `SIGO — ${dateLabel}: sem avisos` : `SIGO — ${dateLabel}: ${plural(alerts.length, "aviso", "avisos")}${critical ? ` (${critical} crítico${critical > 1 ? "s" : ""})` : ""}`;
  if (alerts.length === 0) {
    const t = "Nenhuma das regras de aviso do SIGO foi disparada hoje.";
    return { subject, text: t, html: `<p>${t}</p>` };
  }
  const text = alerts.map((a) => `[${ALERT_SEVERITY_LABEL[a.severity]}] ${a.title}\n  ${a.detail}\n  ${baseUrl}${a.href}`).join("\n\n");
  const color: Record<AlertSeverity, string> = { CRITICO: "#b91c1c", ALTO: "#c2410c", ATENCAO: "#a16207" };
  const html =
    `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">` +
    `<p style="margin:0 0 12px"><strong>Avisos do SIGO — ${dateLabel}</strong></p>` +
    alerts
      .map(
        (a) =>
          `<p style="margin:0 0 12px;padding-left:10px;border-left:3px solid ${color[a.severity]}">` +
          `<strong style="color:${color[a.severity]}">${ALERT_SEVERITY_LABEL[a.severity]}</strong> · ${a.title}<br>` +
          `<span style="color:#555">${a.detail}</span><br><a href="${baseUrl}${a.href}">Abrir no SIGO</a></p>`,
      )
      .join("") +
    `</div>`;
  return { subject, text, html };
}
