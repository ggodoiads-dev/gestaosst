// Gerado da planilha SWOT_Log20_VIDROS (aba KPI, acumulado até set/2026). Nada aqui é inventado: meta, resultado, impacto e
// pilar vêm da planilha; `polarity` (sentido da meta) foi deduzido para reproduzir o 'Bateu/Não bateu' dela — e onde a planilha
// parece inconsistente fica uma `review` para o gerente confirmar.
import type { CascadePace, CascadePolarity, CascadeUnit } from "./status";

export type SeedIc = {
  key: string;
  pilar: string;
  name: string;
  unit: CascadeUnit;
  target: number;
  value: number;
  polarity: CascadePolarity;
  impact: "ALTO" | "BAIXO";
  pace: CascadePace;
  review: string | null;
};

export const SEED_SONHO = "Ser a logística número 1 da SAZ";
export const SEED_PERIOD = "2026-09";
export const SEED_PILARES = ["Financeiro", "Segurança", "Gente", "Operação", "Manutenção"] as const;

export const SEED_ICS: SeedIc[] = [
  {
    "pilar": "Financeiro",
    "name": "Custos Operacionais",
    "unit": "PERCENT",
    "target": 85.49,
    "value": 76.46,
    "polarity": "HIGHER",
    "impact": "ALTO",
    "pace": "NONE",
    "review": "Pela planilha, 76,46% contra a meta de 85,49% é 'Não bateu' (maior é melhor). Confira o sentido.",
    "key": "custos-operacionais"
  },
  {
    "pilar": "Financeiro",
    "name": "Despesas Administrativas",
    "unit": "PERCENT",
    "target": 11.41,
    "value": 19.49,
    "polarity": "LOWER",
    "impact": "ALTO",
    "pace": "NONE",
    "review": null,
    "key": "despesas-administrativas"
  },
  {
    "pilar": "Financeiro",
    "name": "Pacote de Manutenção",
    "unit": "PERCENT",
    "target": 4.07,
    "value": 4.41,
    "polarity": "HIGHER",
    "impact": "ALTO",
    "pace": "NONE",
    "review": null,
    "key": "pacote-de-manutencao"
  },
  {
    "pilar": "Financeiro",
    "name": "Pacote de Gente",
    "unit": "PERCENT",
    "target": 80.17,
    "value": 78.34,
    "polarity": "LOWER",
    "impact": "ALTO",
    "pace": "NONE",
    "review": null,
    "key": "pacote-de-gente"
  },
  {
    "pilar": "Financeiro",
    "name": "EBITDA",
    "unit": "PERCENT",
    "target": 12.7,
    "value": 22.5,
    "polarity": "HIGHER",
    "impact": "ALTO",
    "pace": "NONE",
    "review": null,
    "key": "ebitda"
  },
  {
    "pilar": "Financeiro",
    "name": "Pacote de Perdas",
    "unit": "MONEY",
    "target": 0.0,
    "value": 0.0,
    "polarity": "LOWER",
    "impact": "BAIXO",
    "pace": "NONE",
    "review": null,
    "key": "pacote-de-perdas"
  },
  {
    "pilar": "Financeiro",
    "name": "Gastos totais",
    "unit": "PERCENT",
    "target": 74.08,
    "value": 56.97,
    "polarity": "LOWER",
    "impact": "BAIXO",
    "pace": "NONE",
    "review": null,
    "key": "gastos-totais"
  },
  {
    "pilar": "Segurança",
    "name": "TRI",
    "unit": "NUMBER",
    "target": 0.0,
    "value": 0.0,
    "polarity": "LOWER",
    "impact": "ALTO",
    "pace": "NONE",
    "review": null,
    "key": "tri"
  },
  {
    "pilar": "Segurança",
    "name": "FAI",
    "unit": "NUMBER",
    "target": 0.0,
    "value": 1.0,
    "polarity": "LOWER",
    "impact": "ALTO",
    "pace": "NONE",
    "review": null,
    "key": "fai"
  },
  {
    "pilar": "Segurança",
    "name": "QLP Relatando",
    "unit": "PERCENT",
    "target": 80.0,
    "value": 89.5,
    "polarity": "HIGHER",
    "impact": "ALTO",
    "pace": "NONE",
    "review": "A planilha marca 'Não bateu' com 89,5% contra a meta de 80%. Se a meta é o % de gente relatando (maior é melhor), bateu. Confira o sentido.",
    "key": "qlp-relatando"
  },
  {
    "pilar": "Segurança",
    "name": "Check list de Ferramentas",
    "unit": "PERCENT",
    "target": 90.0,
    "value": 90.0,
    "polarity": "HIGHER",
    "impact": "ALTO",
    "pace": "NONE",
    "review": null,
    "key": "check-list-de-ferramentas"
  },
  {
    "pilar": "Segurança",
    "name": "DTO (DMPeople)",
    "unit": "NUMBER",
    "target": 216.0,
    "value": 13.0,
    "polarity": "HIGHER",
    "impact": "ALTO",
    "pace": "YEAR",
    "review": null,
    "key": "dto-dmpeople"
  },
  {
    "pilar": "Segurança",
    "name": "Monitoramentos",
    "unit": "NUMBER",
    "target": 156.0,
    "value": 100.0,
    "polarity": "HIGHER",
    "impact": "ALTO",
    "pace": "YEAR",
    "review": null,
    "key": "monitoramentos"
  },
  {
    "pilar": "Gente",
    "name": "GAP de Contratação",
    "unit": "PERCENT",
    "target": 1.58,
    "value": 8.71,
    "polarity": "LOWER",
    "impact": "ALTO",
    "pace": "NONE",
    "review": null,
    "key": "gap-de-contratacao"
  },
  {
    "pilar": "Gente",
    "name": "Disponibilidade de gente",
    "unit": "PERCENT",
    "target": 94.23,
    "value": 92.83,
    "polarity": "HIGHER",
    "impact": "BAIXO",
    "pace": "NONE",
    "review": "A planilha marca 'Bateu' com 92,83% contra a meta de 94,23%. Se maior é melhor, não bateu. Confira o sentido.",
    "key": "disponibilidade-de-gente"
  },
  {
    "pilar": "Gente",
    "name": "TO operacional",
    "unit": "PERCENT",
    "target": 14.81,
    "value": 13.6,
    "polarity": "LOWER",
    "impact": "ALTO",
    "pace": "NONE",
    "review": null,
    "key": "to-operacional"
  },
  {
    "pilar": "Gente",
    "name": "TO geral",
    "unit": "PERCENT",
    "target": 14.07,
    "value": 12.89,
    "polarity": "LOWER",
    "impact": "ALTO",
    "pace": "NONE",
    "review": null,
    "key": "to-geral"
  },
  {
    "pilar": "Gente",
    "name": "LTO",
    "unit": "PERCENT",
    "target": 3.0,
    "value": 0.0,
    "polarity": "LOWER",
    "impact": "BAIXO",
    "pace": "NONE",
    "review": null,
    "key": "lto"
  },
  {
    "pilar": "Gente",
    "name": "TONH",
    "unit": "PERCENT",
    "target": 15.0,
    "value": 20.0,
    "polarity": "LOWER",
    "impact": "ALTO",
    "pace": "NONE",
    "review": null,
    "key": "tonh"
  },
  {
    "pilar": "Gente",
    "name": "ABS",
    "unit": "PERCENT",
    "target": 1.49,
    "value": 0.51,
    "polarity": "LOWER",
    "impact": "ALTO",
    "pace": "NONE",
    "review": null,
    "key": "abs"
  },
  {
    "pilar": "Gente",
    "name": "LogOn",
    "unit": "PERCENT",
    "target": 90.0,
    "value": 92.51,
    "polarity": "HIGHER",
    "impact": "ALTO",
    "pace": "NONE",
    "review": null,
    "key": "logon"
  },
  {
    "pilar": "Gente",
    "name": "Prazo vagas abertas",
    "unit": "DAYS",
    "target": 45.0,
    "value": 19.0,
    "polarity": "LOWER",
    "impact": "BAIXO",
    "pace": "NONE",
    "review": null,
    "key": "prazo-vagas-abertas"
  },
  {
    "pilar": "Gente",
    "name": "Pesquisa de Engagement",
    "unit": "PERCENT",
    "target": 90.0,
    "value": 77.35,
    "polarity": "HIGHER",
    "impact": "BAIXO",
    "pace": "NONE",
    "review": null,
    "key": "pesquisa-de-engagement"
  },
  {
    "pilar": "Gente",
    "name": "SKAP",
    "unit": "PERCENT",
    "target": 90.0,
    "value": 46.11,
    "polarity": "HIGHER",
    "impact": "BAIXO",
    "pace": "NONE",
    "review": null,
    "key": "skap"
  },
  {
    "pilar": "Gente",
    "name": "Acompanhamento de novos",
    "unit": "PERCENT",
    "target": 90.0,
    "value": 93.63,
    "polarity": "HIGHER",
    "impact": "ALTO",
    "pace": "NONE",
    "review": null,
    "key": "acompanhamento-de-novos"
  },
  {
    "pilar": "Operação",
    "name": "TMA",
    "unit": "MINUTES",
    "target": 3.0,
    "value": 3.8167,
    "polarity": "LOWER",
    "impact": "ALTO",
    "pace": "NONE",
    "review": null,
    "key": "tma"
  },
  {
    "pilar": "Operação",
    "name": "TMC",
    "unit": "MINUTES",
    "target": 60.0,
    "value": 40.0,
    "polarity": "HIGHER",
    "impact": "ALTO",
    "pace": "NONE",
    "review": "Pela planilha, 40 min contra a meta de 60 min é 'Não bateu' (maior é melhor). Confira o sentido.",
    "key": "tmc"
  },
  {
    "pilar": "Operação",
    "name": "Paletes reformados",
    "unit": "NUMBER",
    "target": 184500.0,
    "value": 138375.0,
    "polarity": "HIGHER",
    "impact": "BAIXO",
    "pace": "YEAR",
    "review": null,
    "key": "paletes-reformados"
  },
  {
    "pilar": "Operação",
    "name": "Seleção de chapatex",
    "unit": "NUMBER",
    "target": 410000.0,
    "value": 284710.0,
    "polarity": "HIGHER",
    "impact": "BAIXO",
    "pace": "YEAR",
    "review": null,
    "key": "selecao-de-chapatex"
  },
  {
    "pilar": "Operação",
    "name": "Carros carregados",
    "unit": "NUMBER",
    "target": 5400.0,
    "value": 2412.0,
    "polarity": "HIGHER",
    "impact": "BAIXO",
    "pace": "YEAR",
    "review": null,
    "key": "carros-carregados"
  },
  {
    "pilar": "Manutenção",
    "name": "Check list empilhadeira",
    "unit": "PERCENT",
    "target": 100.0,
    "value": 97.41,
    "polarity": "HIGHER",
    "impact": "ALTO",
    "pace": "NONE",
    "review": null,
    "key": "check-list-empilhadeira"
  },
  {
    "pilar": "Manutenção",
    "name": "Check list de paleteira",
    "unit": "PERCENT",
    "target": 100.0,
    "value": 100.0,
    "polarity": "HIGHER",
    "impact": "ALTO",
    "pace": "NONE",
    "review": null,
    "key": "check-list-de-paleteira"
  },
  {
    "pilar": "Manutenção",
    "name": "Stress test",
    "unit": "PERCENT",
    "target": 100,
    "value": 100.0,
    "polarity": "HIGHER",
    "impact": "ALTO",
    "pace": "NONE",
    "review": null,
    "key": "stress-test"
  },
  {
    "pilar": "Manutenção",
    "name": "Manutenção preventiva",
    "unit": "PERCENT",
    "target": 100.0,
    "value": 100.0,
    "polarity": "HIGHER",
    "impact": "ALTO",
    "pace": "NONE",
    "review": null,
    "key": "manutencao-preventiva"
  },
  {
    "pilar": "Manutenção",
    "name": "MTBF e MTTR",
    "unit": "PERCENT",
    "target": 90.0,
    "value": 99.31,
    "polarity": "HIGHER",
    "impact": "ALTO",
    "pace": "NONE",
    "review": null,
    "key": "mtbf-e-mttr"
  },
  {
    "pilar": "Manutenção",
    "name": "Ordem de serviço",
    "unit": "PERCENT",
    "target": 100,
    "value": 100,
    "polarity": "HIGHER",
    "impact": "ALTO",
    "pace": "NONE",
    "review": null,
    "key": "ordem-de-servico"
  }
];
