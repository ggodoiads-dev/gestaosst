import { describe, expect, it } from "vitest";
import { buildAlerts, renderDigest, type AlertInput } from "./rules";

const base: AlertInput = {
  qualifications: { asoExpired: 0, otherExpired: 0, expiring30: 0, asoExpiring30: 0 },
  nonconformities: { criticalOpen: 0, highOpenOver7Days: 0, overdue: 0 },
  recentAccidents: { total: 0, withInjuryOrSif: 0, codes: [] },
  overdueActions: 0,
};

describe("buildAlerts", () => {
  it("sem nada fora do limite, não há aviso", () => {
    expect(buildAlerts(base)).toEqual([]);
  });

  it("ordena do mais grave para o menos grave", () => {
    const alerts = buildAlerts({
      ...base,
      qualifications: { asoExpired: 2, otherExpired: 1, expiring30: 3, asoExpiring30: 1 },
      nonconformities: { criticalOpen: 1, highOpenOver7Days: 0, overdue: 0 },
    });
    expect(alerts.map((a) => a.severity)).toEqual(["CRITICO", "CRITICO", "ALTO", "ATENCAO"]);
    expect(alerts[0].title).toBe("2 ASOs vencidos");
  });

  it("ocorrência com lesão ou SIF é crítica; sem isso, só atenção", () => {
    expect(buildAlerts({ ...base, recentAccidents: { total: 1, withInjuryOrSif: 1, codes: ["ACID-000010"] } })[0]).toMatchObject({ severity: "CRITICO", key: "acidente-grave" });
    expect(buildAlerts({ ...base, recentAccidents: { total: 2, withInjuryOrSif: 0, codes: [] } })[0]).toMatchObject({ severity: "ATENCAO", key: "acidente-recente" });
  });

  it("usa singular e plural", () => {
    expect(buildAlerts({ ...base, qualifications: { ...base.qualifications, asoExpired: 1 } })[0].title).toBe("1 ASO vencido");
    expect(buildAlerts({ ...base, overdueActions: 4 })[0].title).toBe("4 ações de plano de ação vencidas");
  });
});

describe("renderDigest", () => {
  it("sem avisos, diz que nada disparou", () => {
    const d = renderDigest([], "https://sigo.log.br", "02/11/2026");
    expect(d.subject).toContain("sem avisos");
    expect(d.text).toContain("Nenhuma");
  });

  it("com avisos, o assunto conta e destaca os críticos", () => {
    const d = renderDigest(buildAlerts({ ...base, qualifications: { ...base.qualifications, asoExpired: 1, expiring30: 2 } }), "https://sigo.log.br", "02/11/2026");
    expect(d.subject).toBe("SIGO — 02/11/2026: 2 avisos (1 crítico)");
    expect(d.text).toContain("https://sigo.log.br/relatorios?tipo=qualificacoes");
    expect(d.html).toContain("Abrir no SIGO");
  });
});
