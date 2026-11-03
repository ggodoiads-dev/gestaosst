/**
 * Cascata do turnover no modelo IC → IV: o IC é o "TO geral" (o resultado); os IVs abrem o COMO/POR QUÊ: pedidos de demissão e o motivo de cada um,
 * saídas precoces, entrevista feita, satisfação de quem saiu e onde as saídas se concentram. Cada IV tem um valor calculado pelo SIGO
 * (`sigoKey`, ver turnover-metrics.ts). Meta só onde há base objetiva; o resto fica "sem meta" até o RH decidir.
 */
import { EXIT_RATINGS, EXIT_REASONS } from "./interview";
import type { CascadePace, CascadePolarity, CascadeUnit } from "@/domain/cascade/status";
import { surveyKey } from "./turnover-metrics";
import type { MotivosTempo, Satisfacao } from "./survey";

export const TURNOVER_IC_SEED_KEY = "ic:to-geral";
export const TURNOVER_IC_SIGO_KEY = "turnover.rolling12";

export type SeedIvNode = {
  seedKey: string;
  parentSeedKey: string;
  kind: "IV";
  name: string;
  unit?: CascadeUnit;
  polarity?: CascadePolarity;
  pace?: CascadePace;
  target?: number | null;
  sigoKey?: string;
  description?: string;
};

/** Perguntas para investigar o "por quê?" de cada motivo (chave de EXIT_REASONS). Entram na descrição do IV, para guiar quem abre o próximo nível. */
export const WHY_PROMPTS: Record<string, string[]> = {
  SALARIO: ["Está abaixo do mercado da região ou do que o cargo recebe em outra operação?", "A queixa é o valor base, a falta de reajuste ou a diferença entre quem entrou antes e depois?", "Existe plano de cargos e salários conhecido por quem trabalha?"],
  BENEFICIOS: ["Qual benefício pesou (alimentação, saúde, transporte, PLR)? O que falta ou é fraco?", "Está abaixo do que outras empresas da região oferecem?", "A pessoa sabia do benefício na contratação ou foi uma expectativa que não se cumpriu?"],
  LIDERANCA: ["O problema é com o líder direto, com o estilo de gestão ou com a falta de feedback?", "O líder foi treinado para liderar ou só promovido por desempenho técnico?", "Os pedidos de demissão se concentram em poucos líderes?"],
  CLIMA: ["O atrito é entre colegas, entre turnos ou entre equipes?", "Há conflito recorrente que ninguém trata?", "A integração apresenta a pessoa ao time ou ela entra sozinha?"],
  CARGA_ESCALA: ["O problema é a escala (folgas, fim de semana, 6x1), as horas extras ou o ritmo da tarefa?", "Falta gente na equipe, de modo que o resto compensa?", "A escala foi combinada na contratação ou mudou depois?"],
  CRESCIMENTO: ["Existe caminho de carreira visível (de ajudante a conferente, de conferente a líder)?", "As vagas internas são divulgadas e ocupadas por quem já está?", "Quanto tempo se espera, em média, por uma promoção?"],
  PROPOSTA: ["Para onde foram e com que salário e benefícios?", "A proposta melhor é só de valor ou também de escala, local ou tipo de contrato?", "Dava para ter feito uma contraproposta?"],
  DISTANCIA: ["Quantas pessoas moram longe do local e como chegam (transporte fretado, vale, carro)?", "O horário do turno combina com o transporte público?", "A distância aparece na seleção?"],
  SAUDE_PESSOAL: ["É motivo pessoal de fato ou é o que a pessoa diz para não criticar a empresa?", "Há padrão por turno, idade ou tempo de casa?", "Dá para a empresa apoiar (licença, flexibilidade) antes de a pessoa sair?"],
  ADAPTACAO: ["A função foi apresentada como é na seleção (esforço físico, ritmo, ambiente)?", "Houve treinamento prático e acompanhamento nos primeiros dias?", "O perfil contratado combina com a função?"],
  OUTRO: ["O texto livre das entrevistas aponta algum padrão que ainda não tem categoria?"],
};

const ASK = "Pergunte o por quê: ";
const asks = (list: string[]) => ASK + list.join(" · ");

/** Nota que o colaborador deu a um item → motivo ao qual ela pertence (o IV da nota abre embaixo do motivo). */
const RATING_UNDER_MOTIVE: Record<string, string> = { salario: "SALARIO", beneficios: "BENEFICIOS", lideranca: "LIDERANCA", ambiente: "CLIMA" };

/** Categorias da plataforma de entrevistas que o SIGO sabe ler (a chave é o texto sem acento e pontuação). */
export const PLATFORM_CATEGORIES: { key: string; name: string }[] = [
  { key: "remuneracao", name: "Remuneração" },
  { key: "beneficios", name: "Benefícios" },
  { key: "liderancaimediata", name: "Liderança imediata" },
  { key: "percepcoesgerais", name: "Percepções gerais" },
  { key: "diversidadeinclusaoecompliance", name: "Diversidade, inclusão e compliance" },
];

/** Estrutura estática dos IVs do IC "TO geral". Os IVs por turno, área e cargo são criados a partir dos desligamentos importados (serviço). */
export function turnoverStaticIvs(): SeedIvNode[] {
  const IC = TURNOVER_IC_SEED_KEY;
  const out: SeedIvNode[] = [
    {
      seedKey: "iv:to:demissao",
      parentSeedKey: IC,
      kind: "IV",
      name: "Pedidos de demissão (% das saídas)",
      unit: "PERCENT",
      polarity: "LOWER",
      sigoKey: "turnover.voluntary.pct",
      description: "Parte das saídas que foi decisão do colaborador: é aqui que o 'por quê?' das entrevistas de desligamento se abre. Sem meta ainda: informe quantos % são aceitáveis.",
    },
  ];

  out.push({
    seedKey: "iv:to:entrevista",
    parentSeedKey: "iv:to:demissao",
    kind: "IV",
    name: "Entrevistas de desligamento registradas por pessoa (% dos pedidos de demissão)",
    unit: "PERCENT",
    polarity: "HIGHER",
    target: 100,
    sigoKey: "turnover.interviews.coverage",
    description: "Sem entrevista, o PDCA trabalha com hipótese e não com o motivo dito por quem saiu. Registre a entrevista de cada pedido de demissão (ou importe a planilha de entrevistas): os motivos abaixo só ganham valor depois disso.",
  });

  for (const r of EXIT_REASONS) {
    out.push({
      seedKey: `iv:to:motivo:${r.key}`,
      parentSeedKey: "iv:to:entrevista",
      kind: "IV",
      name: `${r.label} como motivo principal (entrevistas por pessoa, %)`,
      unit: "PERCENT",
      polarity: "LOWER",
      sigoKey: `turnover.motive:${r.key}`,
      description: asks(WHY_PROMPTS[r.key] ?? []),
    });
  }
  for (const rt of EXIT_RATINGS) {
    const motive = RATING_UNDER_MOTIVE[rt.key];
    if (!motive) continue;
    out.push({
      seedKey: `iv:to:nota:${rt.key}`,
      parentSeedKey: `iv:to:motivo:${motive}`,
      kind: "IV",
      name: `Nota de ${rt.label.toLowerCase()} dada por quem saiu (1 a 5)`,
      unit: "NUMBER",
      polarity: "HIGHER",
      sigoKey: `turnover.rating:${rt.key}`,
      description: "Média das notas das entrevistas de desligamento da janela. Sem meta ainda: informe a nota mínima aceitável.",
    });
  }

  out.push(
    {
      seedKey: "iv:to:precoce",
      parentSeedKey: IC,
      kind: "IV",
      name: "Saídas em até 90 dias (% das saídas com data de admissão)",
      unit: "PERCENT",
      polarity: "LOWER",
      sigoKey: "turnover.early90.pct",
      description: asks(["O que foi prometido na seleção e o que a pessoa encontrou na prática?", "A integração e o treinamento dos primeiros dias foram completos e com acompanhamento do líder?", "A seleção está trazendo o perfil certo para a função?"]),
    },
    {
      seedKey: "iv:to:nota:treinamento",
      parentSeedKey: "iv:to:precoce",
      kind: "IV",
      name: "Nota de treinamento e integração dada por quem saiu (1 a 5)",
      unit: "NUMBER",
      polarity: "HIGHER",
      sigoKey: "turnover.rating:treinamento",
      description: "Média das notas das entrevistas de desligamento da janela. Sem meta ainda.",
    },
    {
      seedKey: "iv:to:voltaria",
      parentSeedKey: IC,
      kind: "IV",
      name: "Quem saiu voltaria a trabalhar aqui (%)",
      unit: "PERCENT",
      polarity: "HIGHER",
      sigoKey: "turnover.wouldreturn.pct",
      description: "Entre os entrevistados que responderam. Sem meta ainda.",
    },
    {
      seedKey: "iv:to:plataforma",
      parentSeedKey: IC,
      kind: "IV",
      name: "Satisfação de quem saiu (plataforma de entrevistas)",
      unit: "PERCENT",
      polarity: "HIGHER",
      sigoKey: "turnover.platform.sat:total",
      description: "Tabela somada da plataforma externa (importada em Desligamentos › Resumo da plataforma). Não depende do mês escolhido.",
    },
  );
  for (const c of PLATFORM_CATEGORIES) {
    out.push({
      seedKey: `iv:to:plat:${c.key}`,
      parentSeedKey: "iv:to:plataforma",
      kind: "IV",
      name: `Satisfação com ${c.name.toLowerCase()}`,
      unit: "PERCENT",
      polarity: "HIGHER",
      sigoKey: `turnover.platform.sat:${c.key}`,
      description: "O que, nesta categoria, a pessoa avaliou pior? Compare com a pesquisa de clima de quem ficou.",
    });
  }

  out.push({
    seedKey: "iv:to:plat:criticos",
    parentSeedKey: "iv:to:plataforma",
    kind: "IV",
    name: "Itens críticos nas respostas de quem saiu (%)",
    unit: "PERCENT",
    polarity: "LOWER",
    sigoKey: "turnover.platform.crit:total",
    description: "% das respostas marcadas como crítica na plataforma de entrevistas. Quanto menor, melhor.",
  });

  out.push(
    { seedKey: "iv:to:turno", parentSeedKey: IC, kind: "IV", name: "Saídas por turno (% das saídas)", unit: "PERCENT", polarity: "LOWER", description: "Onde as saídas se concentram. Um turno com mais saídas que o resto pede olhar liderança, escala e carga." },
    { seedKey: "iv:to:area", parentSeedKey: IC, kind: "IV", name: "Saídas por área (% das saídas)", unit: "PERCENT", polarity: "LOWER", description: "Concentração das saídas por área." },
    { seedKey: "iv:to:cargo", parentSeedKey: IC, kind: "IV", name: "Saídas por cargo (% das saídas)", unit: "PERCENT", polarity: "LOWER", description: "Concentração das saídas pelos cargos que mais perdem gente." },
  );
  return out;
}

/** IV de um turno/área/cargo concreto. `value` é o nome como veio da planilha de desligamentos. */
export function turnoverDimensionIv(dim: "turno" | "area" | "cargo", value: string): SeedIvNode {
  const slug = value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  const label = { turno: "Turno", area: "Área", cargo: "Cargo" }[dim];
  return {
    seedKey: `iv:to:${dim}:${slug}`,
    parentSeedKey: `iv:to:${dim}`,
    kind: "IV",
    name: `${label}: ${value}`,
    unit: "PERCENT",
    polarity: "LOWER",
    sigoKey: `turnover.${dim}:${encodeURIComponent(value)}`,
    description: `% das saídas da janela que eram de ${label.toLowerCase()} ${value}. O que é diferente aqui (liderança, escala, carga, ambiente)?`,
  };
}

/** Perguntas de investigação para um motivo da plataforma (o texto vem da plataforma; casa por palavra-chave com as chaves de EXIT_REASONS). */
export function promptsForPlatformMotive(motivo: string): string[] {
  const t = surveyKey(motivo);
  const pick = (key: string) => WHY_PROMPTS[key] ?? [];
  if (t.includes("gestor") || t.includes("lideran")) return pick("LIDERANCA");
  if (t.includes("carreira") || t.includes("crescimento")) return pick("CRESCIMENTO");
  if (t.includes("pessoais")) return pick("SAUDE_PESSOAL");
  if (t.includes("ambiente")) return pick("CLIMA");
  if (t.includes("papeis") || t.includes("responsabilidades")) return pick("ADAPTACAO");
  if (t.includes("remunera") || t.includes("salar")) return pick("SALARIO");
  if (t.includes("benefic")) return pick("BENEFICIOS");
  if (t.includes("estrategia") || t.includes("cultura")) return ["Que decisão, mudança de regra ou comunicação da empresa pesou?", "A pessoa entendeu o rumo da operação ou sentiu que ele mudava sem explicação?"];
  return [];
}

/** IVs dos motivos da tabela da plataforma (motivo × tempo de casa): um IV por motivo, com o maior % entre as faixas, e um IV por faixa que tem valor. */
export function platformMotiveIvs(m: MotivosTempo | null): SeedIvNode[] {
  const out: SeedIvNode[] = [];
  for (const row of m?.rows ?? []) {
    const known = row.values.map((v, i) => ({ v, bucket: m!.buckets[i] })).filter((x): x is { v: number; bucket: string } => x.v !== null);
    if (known.length === 0) continue;
    const key = surveyKey(row.motivo);
    const parts = known.map((x) => `${x.bucket}: ${x.v.toLocaleString("pt-BR")}%`).join(" · ");
    const prompts = promptsForPlatformMotive(row.motivo);
    out.push({
      seedKey: `iv:to:pm:${key}`,
      parentSeedKey: "iv:to:demissao",
      kind: "IV",
      name: `${row.motivo} (plataforma: % na faixa de tempo de casa em que mais pesa)`,
      unit: "PERCENT",
      polarity: "LOWER",
      sigoKey: `turnover.platform.motive:${key}`,
      description: `Por tempo de casa — ${parts}.${prompts.length ? ` ${asks(prompts)}` : ""}`,
    });
    for (const x of known) {
      out.push({
        seedKey: `iv:to:pm:${key}:${surveyKey(x.bucket)}`,
        parentSeedKey: `iv:to:pm:${key}`,
        kind: "IV",
        name: `${row.motivo} — ${x.bucket.toLowerCase()} de casa`,
        unit: "PERCENT",
        polarity: "LOWER",
        sigoKey: `turnover.platform.motive:${key}~${surveyKey(x.bucket)}`,
        description: `% das saídas dessa faixa de tempo de casa que citaram este motivo (plataforma de entrevistas). O que acontece nesse momento da vida do colaborador na empresa?`,
      });
    }
  }
  return out;
}

/** Categorias de satisfação da plataforma que não estão na lista fixa (a plataforma pode trazer outras). */
export function platformSatisfactionExtraIvs(s: Satisfacao | null): SeedIvNode[] {
  const known = new Set(PLATFORM_CATEGORIES.map((c) => c.key));
  return (s?.rows ?? [])
    .filter((r) => r.satisfacao !== null && !known.has(surveyKey(r.categoria)))
    .map((r) => ({
      seedKey: `iv:to:plat:${surveyKey(r.categoria)}`,
      parentSeedKey: "iv:to:plataforma",
      kind: "IV" as const,
      name: `Satisfação com ${r.categoria.toLowerCase()}`,
      unit: "PERCENT" as const,
      polarity: "HIGHER" as const,
      sigoKey: `turnover.platform.sat:${surveyKey(r.categoria)}`,
      description: "O que, nesta categoria, a pessoa avaliou pior?",
    }));
}
