import "server-only";
import { db } from "@/server/db";
import { compliancePercent, getChecklistComplianceDashboard } from "@/server/services/checklist-compliance.service";
import { deltaText, kpi, trendTone } from "@/domain/reports/analysis";
import { describeCorrelation, pearson, strengthOf } from "@/domain/reports/correlation";
import type { Finding } from "@/domain/reports/types";
import { lastMonths, range, shortLabel } from "@/server/services/report.service";
import { keyOfDate, sec, tbl, type DetailCtx, type Out } from "@/server/services/report-kit";

const INJURY_TYPES: string[] = ["ACIDENTE_TIPICO", "ACIDENTE_TRAJETO", "FAI", "DOENCA_OCUPACIONAL"];

type Series = { key: string; label: string; values: (number | null)[] };

/** Séries mensais lado a lado (faltas, acidentes, produção, checklist...) e por turno, com a associação entre elas.
 * Só agregados (contagens): nenhum nome de pessoa. A associação é descritiva e não prova causa. */
export async function buildCrossReport(c: DetailCtx): Promise<Out> {
  if (!c.internal) throw new Error("Não há versão do cliente para este relatório: ele contém dados internos de pessoas.");
  const months = lastMonths(c.month, 12);
  const from = range(months[0]).start;
  const to = range(c.month).end;
  const [notes, measures, accidents, guardian, production, turnos, headcount, adherence] = await Promise.all([
    db.scheduleDayNote.findMany({ where: { date: { gte: from, lt: to }, status: { in: ["FALTA", "ATESTADO"] } }, select: { date: true, status: true, collaborator: { select: { turnoId: true } } } }),
    db.disciplinaryMeasure.findMany({ where: { referenceDate: { gte: from, lt: to }, status: "APLICADA" }, select: { referenceDate: true, collaborator: { select: { turnoId: true } } } }).catch(() => []),
    db.accident.findMany({ where: { date: { gte: from, lt: to }, status: { not: "CANCELADA" } }, select: { date: true, type: true } }),
    db.guardianReport.findMany({ where: { reporterCollaboratorId: { not: null }, occurredAt: { gte: from, lt: to } }, select: { occurredAt: true, reporterCollaborator: { select: { turnoId: true } } } }).catch(() => []),
    db.shiftProduction.findMany({ where: { date: { gte: from, lt: to } }, select: { date: true, turnoId: true, values: true } }).catch(() => []),
    db.turno.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.collaborator.groupBy({ by: ["turnoId"], where: { active: true }, _count: { _all: true } }),
    Promise.all(months.map((m) => getChecklistComplianceDashboard(c.user, { month: m }).then((d) => compliancePercent(d.month)).catch(() => null))),
  ]);
  const loaded = (r: { values: unknown }) => (r.values as Record<string, number> | null)?.carrosCarregados ?? 0;
  const inMonth = <T,>(list: T[], at: (t: T) => Date | null, m: string) =>
    list.filter((t) => {
      const d = at(t);
      return d !== null && keyOfDate(d) === m;
    });

  const falta = months.map((m) => inMonth(notes, (n) => n.date, m).filter((n) => n.status === "FALTA").length);
  const atest = months.map((m) => inMonth(notes, (n) => n.date, m).filter((n) => n.status === "ATESTADO").length);
  const medidas = months.map((m) => inMonth(measures, (x) => x.referenceDate, m).length);
  const acid = months.map((m) => inMonth(accidents, (a) => a.date, m).length);
  const lesao = months.map((m) => inMonth(accidents, (a) => a.date, m).filter((a) => INJURY_TYPES.includes(a.type)).length);
  const relatos = months.map((m) => inMonth(guardian, (g) => g.occurredAt, m).length);
  const carrosDia = months.map((m) => {
    const rows = inMonth(production, (p) => p.date, m);
    const days = new Set(rows.map((r) => r.date.toISOString().slice(0, 10))).size;
    return days > 0 ? Math.round((rows.reduce((s, r) => s + loaded(r), 0) / days) * 10) / 10 : null;
  });

  const series: Series[] = [
    { key: "falta", label: "Faltas", values: falta },
    { key: "atest", label: "Atestados", values: atest },
    { key: "carros", label: "Carros carregados por dia", values: carrosDia },
    { key: "chk", label: "Aderência de checklist (%)", values: adherence },
    { key: "medidas", label: "Medidas disciplinares", values: medidas },
    { key: "acid", label: "Acidentes e ocorrências", values: acid },
    { key: "lesao", label: "Ocorrências com lesão", values: lesao },
    { key: "guardian", label: "Relatos no Guardian", values: relatos },
  ];
  const by = (k: string) => series.find((x) => x.key === k)!;
  const pairs: [string, string][] = [["falta", "carros"], ["falta", "chk"], ["falta", "acid"], ["chk", "acid"], ["chk", "carros"], ["medidas", "falta"], ["guardian", "acid"], ["atest", "carros"]];
  const rels = pairs.flatMap(([a, b]) => {
    const res = pearson(by(a).values, by(b).values);
    return res ? [{ a: by(a), b: by(b), res }] : [];
  });

  const findings: Finding[] = [];
  const strong = rels.filter((x) => Math.abs(x.res.r) >= 0.6 && x.res.n >= 8 && strengthOf(x.res.r) !== "fraca").sort((p, q) => Math.abs(q.res.r) - Math.abs(p.res.r)).slice(0, 4);
  for (const x of strong) {
    const same = x.res.r > 0;
    findings.push({
      severity: "INFO",
      module: "Análise cruzada",
      title: `${x.a.label} e ${x.b.label.toLowerCase()} ${same ? "andam juntos" : "andam em sentido oposto"} (r = ${x.res.r})`,
      detail: `Nos ${x.res.n} meses com dado, ${same ? "quando um sobe o outro tende a subir" : "quando um sobe o outro tende a cair"}. É associação, não prova de causa.`,
      recommendation: "Usar como pista: olhar os meses extremos e o que mudou neles (escala, equipe, volume, feriados).",
      internalOnly: true,
    });
  }

  // Por turno, no mês: onde faltam pessoas, onde há medidas e relatos, e a produção por relatório de turno.
  const hc = new Map(headcount.map((h) => [h.turnoId ?? "", h._count._all]));
  const turnoRows = turnos
    .map((t) => {
      const f = inMonth(notes, (n) => n.date, c.month).filter((n) => n.collaborator.turnoId === t.id);
      const prod = inMonth(production, (p) => p.date, c.month).filter((p) => p.turnoId === t.id);
      return {
        name: t.name,
        headcount: hc.get(t.id) ?? 0,
        faltas: f.filter((x) => x.status === "FALTA").length,
        atestados: f.filter((x) => x.status === "ATESTADO").length,
        medidas: inMonth(measures, (x) => x.referenceDate, c.month).filter((m) => m.collaborator.turnoId === t.id).length,
        relatos: inMonth(guardian, (g) => g.occurredAt, c.month).filter((g) => g.reporterCollaborator?.turnoId === t.id).length,
        carrosPorRelatorio: prod.length ? Math.round((prod.reduce((s, r) => s + loaded(r), 0) / prod.length) * 10) / 10 : null,
      };
    })
    .filter((r) => r.headcount > 0 || r.faltas + r.medidas + r.relatos > 0);
  const rate = (r: (typeof turnoRows)[number]) => (r.headcount ? (r.faltas / r.headcount) * 100 : 0);
  const worstAbsence = [...turnoRows].sort((a, b) => rate(b) - rate(a))[0];
  const lowestProd = [...turnoRows.filter((r) => r.carrosPorRelatorio !== null)].sort((a, b) => (a.carrosPorRelatorio ?? 0) - (b.carrosPorRelatorio ?? 0))[0];
  if (worstAbsence && lowestProd && turnoRows.length >= 2 && worstAbsence.name === lowestProd.name && rate(worstAbsence) > 0) {
    findings.push({
      severity: "ATENCAO",
      module: "Análise cruzada",
      title: `Turno ${worstAbsence.name} tem mais faltas por colaborador e a menor produção por relatório no mês`,
      detail: `${worstAbsence.faltas} falta(s) para ${worstAbsence.headcount} pessoa(s); ${lowestProd.carrosPorRelatorio} carros carregados por relatório de turno.`,
      recommendation: "Verificar cobertura de equipe e liderança do turno antes de concluir que o problema é de produtividade.",
      internalOnly: true,
    });
  }

  const cell = (v: number | null) => (v === null ? "—" : v);
  const last = 11;
  return {
    title: "Análise cruzada: pessoas, segurança e operação",
    executive: [
      kpi("x1", "Faltas no mês", String(falta[last]), trendTone(falta[last], falta[last - 1], false), deltaText(falta[last], falta[last - 1], "abs")),
      kpi("x2", "Carros carregados por dia", carrosDia[last] === null ? "—" : String(carrosDia[last]), trendTone(carrosDia[last], carrosDia[last - 1], true), deltaText(carrosDia[last], carrosDia[last - 1], "pct")),
      kpi("x3", "Aderência de checklist", adherence[last] === null ? "—" : `${adherence[last]}%`, trendTone(adherence[last], adherence[last - 1], true), deltaText(adherence[last], adherence[last - 1], "pts")),
      kpi("x4", "Relações fortes nos 12 meses", String(strong.length), "neutral"),
    ],
    findings,
    sections: [
      sec("cx-series", "As séries lado a lado", "Os mesmos 12 meses para cada indicador, para ver o que subiu ou caiu junto. Faltas e atestados vêm da escala; carros por dia, dos relatórios de turno; aderência, do checklist; medidas, da escada disciplinar.", {
        series: [
          { title: "Faltas por mês", highlightLast: true, points: months.map((m, i) => ({ label: shortLabel(m), value: falta[i] })) },
          { title: "Carros carregados por dia", highlightLast: true, points: months.map((m, i) => ({ label: shortLabel(m), value: carrosDia[i] ?? 0 })) },
          { title: "Aderência de checklist (%)", unit: "%", highlightLast: true, points: months.map((m, i) => ({ label: shortLabel(m), value: adherence[i] ?? 0 })) },
        ],
        tables: [tbl("Os 12 meses", ["Mês", ...series.map((x) => x.label)], months.map((m, i) => [shortLabel(m), ...series.map((x) => cell(x.values[i]))]), { rightAlign: series.map((_, i) => i + 1) })],
      }),
      sec("cx-relacoes", "O que anda junto", "Correlação de Pearson entre pares de séries mensais (exige 6 meses ou mais com dado nas duas). Vai de −1 (sentido oposto) a +1 (mesmo sentido). Mostra associação nos meses observados; não prova que uma coisa causa a outra.", {
        tables: [
          tbl("Pares analisados", ["Série A", "Série B", "r", "Meses", "Leitura"], rels.map((x) => [x.a.label, x.b.label, x.res.r, x.res.n, describeCorrelation(x.res.r)]), {
            rightAlign: [2, 3],
            note: rels.length === 0 ? "Ainda não há 6 meses com dado nas duas séries para nenhum par." : undefined,
          }),
        ],
      }),
      sec("cx-turnos", "Turno a turno no mês", "Onde faltam pessoas, onde há medidas e relatos, e a produção por relatório de turno.", {
        tables: [
          tbl(
            "Comparativo por turno",
            ["Turno", "Pessoas", "Faltas", "Atestados", "Faltas por 100", "Medidas", "Relatos Guardian", "Carros por relatório"],
            turnoRows.map((r) => [`Turno ${r.name}`, r.headcount, r.faltas, r.atestados, r.headcount ? Math.round(rate(r) * 10) / 10 : "—", r.medidas, r.relatos, cell(r.carrosPorRelatorio)]),
            { rightAlign: [1, 2, 3, 4, 5, 6, 7], internalOnly: true },
          ),
        ],
      }),
    ],
  };
}
