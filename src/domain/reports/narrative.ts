import type { Finding, MonthlyReport, ReportSection, ReportSeries, ReportTable } from "./types";

/**
 * Texto corrido do relatório (formato de relatório técnico, ABNT NBR 10719). Tudo aqui é escrito por regra a partir dos números do relatório: nenhuma
 * frase afirma algo que não esteja nos dados. A IA só acrescenta a discussão e as conclusões, e entra marcada como tal.
 */

export type AbntBlock =
  | { type: "p"; text: string }
  | { type: "list"; items: string[] }
  | { type: "table"; n: number; table: ReportTable; source: string }
  | { type: "figure"; n: number; series: ReportSeries; source: string };

export type AbntSection = { number: string; title: string; blocks: AbntBlock[]; level: 1 | 2 };

export type AbntText = { discussao: string[]; conclusoes: string[]; recomendacoes: string[] };

export type AbntContent = {
  resumo: string;
  keywords: string[];
  sections: AbntSection[];
  references: string[];
};

export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

/** "−23 pts vs. mês anterior" → "variação de −23 pts em relação ao mês anterior". */
export function deltaSentence(delta: string): string {
  if (delta.startsWith("= ")) return "valor estável em relação ao mês anterior";
  return `variação de ${delta.replace(" vs. mês anterior", "")} em relação ao mês anterior`;
}

function kpiParagraph(section: ReportSection): string | null {
  if (section.kpis.length === 0) return null;
  const parts = section.kpis.map((k) => {
    const extra = [k.delta ? deltaSentence(k.delta) : null, k.note ?? null].filter(Boolean);
    return `o indicador “${k.label}” registrou ${k.value}${extra.length ? ` (${extra.join("; ")})` : ""}`;
  });
  return `No período analisado, ${joinList(parts)}.`;
}

function tableParagraph(t: ReportTable, n: number): string {
  if (t.rows.length === 0) return `A Tabela ${n} (${t.title.toLowerCase()}) não apresentou registros no período.`;
  const numericSecond = t.columns.length === 2 && typeof t.rows[0][1] === "number";
  const label = (v: string | number) => (String(v).length <= 2 ? `${t.columns[0].toLowerCase()} ${v}` : String(v));
  const top = t.rows.slice(0, 3).map((r) => (numericSecond ? `${label(r[0])} (${r[1]})` : label(r[0])));
  const lead = `A Tabela ${n} apresenta ${t.title.charAt(0).toLowerCase()}${t.title.slice(1)}`;
  const count = t.rows.length > 3 ? `, com ${t.rows.length} registros` : "";
  return `${lead}${count}. Destacam-se, em ordem de apresentação, ${joinList(top)}.${t.note ? ` ${t.note}` : ""}`;
}

function seriesParagraph(s: ReportSeries, n: number): string {
  const pts = s.points;
  if (pts.length === 0) return `A Figura ${n} não possui dados no período.`;
  const max = pts.reduce((a, b) => (b.value > a.value ? b : a));
  const min = pts.reduce((a, b) => (b.value < a.value ? b : a));
  const last = pts[pts.length - 1];
  const unit = s.unit ?? "";
  if (max.value === 0) return `A Figura ${n} apresenta ${s.title.charAt(0).toLowerCase()}${s.title.slice(1)}; não houve registros em nenhum dos períodos considerados.`;
  return `A Figura ${n} apresenta ${s.title.charAt(0).toLowerCase()}${s.title.slice(1)}. O maior valor da série ocorreu em ${max.label} (${max.value}${unit}) e o menor em ${min.label} (${min.value}${unit}); no último período, o valor foi de ${last.value}${unit}.`;
}

function findingsParagraphs(findings: Finding[]): string[] {
  if (findings.length === 0) return ["Não foram detectados pontos críticos pelas regras de classificação adotadas neste relatório."];
  const count = (s: Finding["severity"]) => findings.filter((f) => f.severity === s).length;
  const parts = [
    count("CRITICO") ? `${count("CRITICO")} de nível crítico` : null,
    count("ALTO") ? `${count("ALTO")} de nível alto` : null,
    count("ATENCAO") ? `${count("ATENCAO")} de atenção` : null,
    count("INFO") ? `${count("INFO")} informativo(s)` : null,
  ].filter(Boolean) as string[];
  const out = [`Foram identificados ${findings.length} ponto(s) na análise, sendo ${joinList(parts)}.`];
  for (const f of findings.filter((x) => x.severity === "CRITICO" || x.severity === "ALTO")) {
    out.push(`${f.module}: ${f.title}. ${f.detail}${f.recommendation ? ` Recomenda-se: ${f.recommendation.charAt(0).toLowerCase()}${f.recommendation.slice(1)}` : ""}`);
  }
  const lighter = findings.filter((f) => f.severity === "ATENCAO");
  if (lighter.length > 0) out.push(`Pontos de atenção: ${lighter.map((f) => `${f.module} (${f.title.charAt(0).toLowerCase()}${f.title.slice(1)})`).join("; ")}.`);
  return out;
}

function ensureSentence(text: string): string {
  const t = text.trim();
  return /[.!?…]$/.test(t) ? t : `${t}.`;
}

export const ABNT_REFERENCES = [
  "ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. ABNT NBR 10719: informação e documentação: relatório técnico e/ou científico: apresentação. Rio de Janeiro: ABNT, 2015.",
  "ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. ABNT NBR 6024: informação e documentação: numeração progressiva das seções de um documento escrito: apresentação. Rio de Janeiro: ABNT, 2012.",
  "ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. ABNT NBR ISO 45001: sistemas de gestão de saúde e segurança ocupacional: requisitos com orientações para uso. Rio de Janeiro: ABNT, 2018.",
  "BRASIL. Ministério do Trabalho e Emprego. NR-1: disposições gerais e gerenciamento de riscos ocupacionais. Brasília: MTE.",
];

/** Monta todo o conteúdo do relatório técnico. `ai` (opcional) traz a discussão, as conclusões e as recomendações escritas pela IA. */
export function buildAbntContent(report: MonthlyReport, ai: AbntText | null = null): AbntContent {
  const title = report.title ?? "Relatório mensal de segurança e operação";
  const audience = report.version === "cliente" ? "ao cliente" : "à gestão interna";
  let tableN = 0;
  let figureN = 0;
  const sections: AbntSection[] = [];
  const sectionTitles = report.sections.map((s) => s.title);

  // 1 INTRODUÇÃO
  sections.push({
    number: "1",
    title: "INTRODUÇÃO",
    level: 1,
    blocks: [
      { type: "p", text: `Este relatório técnico apresenta ${title.charAt(0).toLowerCase()}${title.slice(1)}, referente ao período de ${report.monthLabel}, destinado ${audience}. Os dados foram extraídos do Sistema Interno de Gestão Organizacional (SIGO), no qual são registrados e importados os controles de segurança, conformidade e operação da LOG20.` },
      { type: "p", text: `O documento reúne os indicadores do período, compara-os com o mês anterior sempre que há dado disponível, classifica os pontos que exigem atenção segundo regras fixas e apresenta recomendações. ${report.sections.length > 0 ? `Foram analisados os seguintes módulos: ${joinList(sectionTitles.map((t) => t.charAt(0).toLowerCase() + t.slice(1)))}.` : ""}` },
    ],
  });

  // 2 OBJETIVOS
  sections.push({
    number: "2",
    title: "OBJETIVOS",
    level: 1,
    blocks: [
      { type: "p", text: `O objetivo geral deste relatório é apresentar, de forma objetiva e verificável, a situação de ${report.monthLabel} nos módulos analisados, identificando desvios, tendências e ações prioritárias.` },
      { type: "p", text: "Como objetivos específicos, buscou-se:" },
      { type: "list", items: ["apresentar os indicadores do período com comparação ao mês anterior;", "identificar os pontos críticos segundo critérios de classificação definidos;", "discutir os resultados e suas possíveis causas, distinguindo fato de hipótese;", "propor ações priorizadas para o período seguinte."] },
    ],
  });

  // 3 METODOLOGIA
  sections.push({
    number: "3",
    title: "METODOLOGIA",
    level: 1,
    blocks: [
      { type: "p", text: "Os números deste relatório são calculados pelo SIGO a partir dos registros lançados pelas equipes e das planilhas importadas até a data de emissão. Nenhum valor foi estimado ou preenchido manualmente na elaboração do documento." },
      { type: "p", text: "As fontes e o alcance de cada módulo são descritos a seguir:" },
      { type: "list", items: report.sections.map((s) => ensureSentence(`${s.title}: ${s.scope}`)) },
      { type: "p", text: "A comparação com o mês anterior é expressa em pontos percentuais (pts) para indicadores em porcentagem e em variação percentual ou absoluta para contagens e tempos. Os pontos críticos são classificados em quatro níveis: crítico (risco à vida ou à conformidade que exige ação imediata), alto (desvio relevante com prazo curto de tratamento), atenção (tendência ou concentração que merece acompanhamento) e informativo (registro sem demanda de ação)." },
      { type: "p", text: "São limitações do método: os indicadores dependem da completude das importações e dos lançamentos até a data de emissão; posições de estoque (como não conformidades abertas) refletem o momento da emissão, e não o último dia do período; e o mês em andamento é parcial." },
    ],
  });

  // 4 RESULTADOS
  sections.push({ number: "4", title: "RESULTADOS", level: 1, blocks: [{ type: "p", text: `Esta seção apresenta os resultados de ${report.monthLabel} por módulo. As tabelas e figuras trazem os valores completos; o texto destaca o que sustenta as conclusões.` }] });
  report.sections.forEach((s, i) => {
    const blocks: AbntBlock[] = [];
    const kp = kpiParagraph(s);
    if (kp) blocks.push({ type: "p", text: kp });
    for (const fig of s.series) {
      figureN++;
      blocks.push({ type: "p", text: seriesParagraph(fig, figureN) });
      blocks.push({ type: "figure", n: figureN, series: fig, source: "SIGO (dados do sistema)." });
    }
    for (const t of s.tables) {
      tableN++;
      blocks.push({ type: "p", text: tableParagraph(t, tableN) });
      blocks.push({ type: "table", n: tableN, table: t, source: `SIGO, módulo ${s.title.charAt(0).toLowerCase()}${s.title.slice(1)}.` });
    }
    for (const note of s.notes) blocks.push({ type: "p", text: ensureSentence(note) });
    sections.push({ number: `4.${i + 1}`, title: s.title, level: 2, blocks });
  });

  // 5 PONTOS CRÍTICOS E DISCUSSÃO
  const discussionBlocks: AbntBlock[] = findingsParagraphs(report.findings).map((text) => ({ type: "p", text }));
  if (ai && ai.discussao.length > 0) {
    discussionBlocks.push({ type: "p", text: "A discussão a seguir foi redigida com apoio de inteligência artificial, a partir exclusivamente dos números deste relatório, e deve ser revisada pelo responsável antes de sua divulgação. As causas apresentadas são hipóteses, não fatos comprovados." });
    for (const text of ai.discussao) discussionBlocks.push({ type: "p", text });
  }
  sections.push({ number: "5", title: "PONTOS CRÍTICOS E DISCUSSÃO", level: 1, blocks: discussionBlocks });

  // 6 CONCLUSÕES
  const crit = report.findings.filter((f) => f.severity === "CRITICO").length;
  const high = report.findings.filter((f) => f.severity === "ALTO").length;
  const baseConclusion =
    crit + high > 0
      ? `Em ${report.monthLabel}, a análise identificou ${crit} ponto(s) crítico(s) e ${high} de nível alto, que demandam ação prioritária no período seguinte, conforme as recomendações da seção 7.`
      : report.findings.length > 0
        ? `Em ${report.monthLabel}, a análise não identificou pontos críticos nem de nível alto; os pontos de atenção apontados devem ser acompanhados no período seguinte.`
        : `Em ${report.monthLabel}, a análise não identificou pontos críticos pelas regras adotadas.`;
  const conclusionBlocks: AbntBlock[] = [{ type: "p", text: baseConclusion }];
  for (const text of ai?.conclusoes ?? []) conclusionBlocks.push({ type: "p", text });
  sections.push({ number: "6", title: "CONCLUSÕES", level: 1, blocks: conclusionBlocks });

  // 7 RECOMENDAÇÕES
  const rule = report.findings.filter((f) => f.recommendation && f.severity !== "INFO").map((f) => ensureSentence(`${f.module}: ${f.recommendation}`));
  const recBlocks: AbntBlock[] = [];
  if (rule.length > 0) {
    recBlocks.push({ type: "p", text: "Com base nas regras de classificação, recomendam-se as seguintes ações:" });
    recBlocks.push({ type: "list", items: rule });
  } else recBlocks.push({ type: "p", text: "Não há recomendações específicas decorrentes das regras de classificação para o período." });
  if (ai && ai.recomendacoes.length > 0) {
    recBlocks.push({ type: "p", text: "Adicionalmente, a análise assistida por inteligência artificial sugere, a critério do responsável:" });
    recBlocks.push({ type: "list", items: ai.recomendacoes.map(ensureSentence) });
  }
  sections.push({ number: "7", title: "RECOMENDAÇÕES", level: 1, blocks: recBlocks });

  const resumo = `Este relatório técnico apresenta ${title.charAt(0).toLowerCase()}${title.slice(1)}, referente a ${report.monthLabel}, elaborado a partir dos dados do Sistema Interno de Gestão Organizacional (SIGO). Foram analisados ${report.sections.length} módulo(s) e comparados os resultados com o mês anterior. ${report.findings.length > 0 ? `Identificaram-se ${crit} ponto(s) crítico(s) e ${high} de nível alto, com recomendações de ação.` : "Não foram identificados pontos críticos pelas regras adotadas."}`;
  const keywords = ["segurança do trabalho", "indicadores", "gestão operacional", report.version === "cliente" ? "relatório ao cliente" : "relatório gerencial"];

  return { resumo, keywords, sections, references: ABNT_REFERENCES };
}
