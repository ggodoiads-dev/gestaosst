/**
 * Cascateamento do PDCA do turnover (Plan): do número até a causa raiz. O SIGO monta sozinho os RAMOS a partir dos dados (como saíram, por que saíram,
 * quando, onde, o que a plataforma de entrevistas aponta); a pessoa desce cada ramo com "por quê?" até chegar na causa raiz, e cada causa recebe ações.
 * Regras puras, sem banco.
 */
import type { PdcaCause } from "./pdca";
import type { MotivosTempo, Satisfacao } from "./survey";

export type CascadeBranch = {
  /** Identificador estável do ramo ("a:motivo:BENEFICIOS"): é o parentId das causas que a pessoa escreve embaixo dele. */
  id: string;
  label: string;
  /** Quantas saídas (ou entrevistados) o ramo representa, quando faz sentido contar. */
  count: number | null;
  pct: number | null;
  /** Base do percentual: "das saídas" ou "dos entrevistados". */
  of: string | null;
  /** Fatos que sustentam o ramo (notas, satisfação, tempo de casa...). */
  facts: string[];
  /** Perguntas para investigar o "por quê?" deste ramo. */
  prompts: string[];
};

export type CascadeGroup = { id: string; title: string; note: string; branches: CascadeBranch[] };

export type CascadeInput = {
  total: number;
  kinds: { label: string; count: number }[];
  /** Entrevistas por pessoa dos desligamentos da janela. */
  motives: { key: string; label: string; count: number; pct: number }[];
  interviewCount: number;
  ratings: { key: string; label: string; avg: number | null; n: number }[];
  wouldReturnPct: number | null;
  tenure: { label: string; count: number }[];
  areas: { label: string; count: number }[];
  turnos: { label: string; count: number }[];
  cargos: { label: string; count: number }[];
  survey: { motivos: MotivosTempo | null; satisfacao: Satisfacao | null; motivosPeriod: string | null; satisfacaoPeriod: string | null };
};

const squash = (s: string) =>
  Array.from(s.normalize("NFD"))
    .filter((ch) => ch.codePointAt(0)! < 0x300)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const pctOf = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
const num = (v: number) => v.toLocaleString("pt-BR");

/** Perguntas de investigação por motivo (chave de EXIT_REASONS). O "por quê?" raramente para no primeiro nível: estas perguntas puxam o segundo. */
export const WHY_PROMPTS: Record<string, string[]> = {
  SALARIO: ["Está abaixo do mercado da região ou abaixo do que o cargo faz em outra operação?", "A queixa é o valor base, a falta de reajuste ou a diferença entre quem entrou antes e depois?", "Existe plano de cargos e salários conhecido por quem trabalha?"],
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

const PROMPTS_BY_BUCKET: Record<string, string[]> = {
  "Até 90 dias": ["O que foi prometido na seleção e o que a pessoa encontrou na prática?", "A integração e o treinamento dos primeiros dias foram completos e com acompanhamento do líder?", "A seleção está trazendo o perfil certo para a função?"],
  "91 a 180 dias": ["O que acontece depois do período de experiência que faz a pessoa sair?", "Houve feedback do líder no fim da experiência?", "A pessoa sentiu que a função mudou do que foi combinado?"],
  "181 a 365 dias": ["O que a pessoa esperava do primeiro ano que não veio (reajuste, promoção, folga)?", "Há alguma data do ano em que as saídas se concentram?"],
  "Mais de 1 ano": ["São pessoas com experiência que recebem proposta de fora? Para onde?", "Houve algo que quebrou a confiança (mudança de escala, de líder, de regra)?"],
};

const PROMPTS_BY_KIND: Record<string, string[]> = {
  "Pedido de demissão": ["Qual o motivo real que as entrevistas mostram? Se há poucas entrevistas, o ramo de motivos abaixo é só hipótese.", "Em que mês e turno se concentram os pedidos?"],
  "Iniciativa da empresa": ["Foi por desempenho, comportamento, ajuste de quadro ou erro de contratação?", "As dispensas se concentram em algum líder ou área?"],
  Acordo: ["Por que o acordo foi preferido à demissão ou ao pedido? Havia pedido informal antes?"],
  "Sem classificação": ["Padronize a forma de demissão na planilha do RH: sem isso não dá para investigar esta parte."],
};

const RATING_OF_MOTIVE: Record<string, string> = { SALARIO: "salario", BENEFICIOS: "beneficios", LIDERANCA: "lideranca", CLIMA: "ambiente", ADAPTACAO: "treinamento" };
const MOTIVE_OF_CATEGORY: Record<string, string> = { remuneracao: "SALARIO", beneficios: "BENEFICIOS", liderancaimediata: "LIDERANCA" };

/** Monta os ramos da cascata. Cada grupo só aparece se tiver dado. */
export function buildCascade(i: CascadeInput): CascadeGroup[] {
  const groups: CascadeGroup[] = [];

  // 1. Como saíram.
  if (i.kinds.length > 0) {
    groups.push({
      id: "forma",
      title: "Como saíram",
      note: "Forma da saída dos últimos 12 meses fechados (só o que conta no turnover).",
      branches: i.kinds.map((k) => ({
        id: `a:forma:${squash(k.label)}`,
        label: k.label,
        count: k.count,
        pct: pctOf(k.count, i.total),
        of: "das saídas",
        facts: [],
        prompts: PROMPTS_BY_KIND[k.label] ?? ["O que está por trás desse tipo de saída?"],
      })),
    });
  }

  // 2. Por que saíram (entrevistas por pessoa).
  if (i.motives.length > 0) {
    groups.push({
      id: "motivo",
      title: "Por que saíram (entrevistas)",
      note: `Motivo principal dito por quem saiu: ${i.interviewCount} entrevista(s) para ${i.total} saída(s) na janela.${i.wouldReturnPct !== null ? ` ${i.wouldReturnPct}% voltariam.` : ""}`,
      branches: i.motives.map((m) => {
        const rating = i.ratings.find((r) => r.key === RATING_OF_MOTIVE[m.key]);
        const facts: string[] = [];
        if (rating && rating.avg !== null) facts.push(`Nota média de ${rating.label.toLowerCase()} dada por quem saiu: ${num(rating.avg)} de 5 (${rating.n} resposta(s)).`);
        const platform = i.survey.satisfacao?.rows.find((r) => MOTIVE_OF_CATEGORY[squash(r.categoria)] === m.key);
        if (platform && platform.satisfacao !== null) facts.push(`Na plataforma de entrevistas, a satisfação com ${platform.categoria.toLowerCase()} é ${num(platform.satisfacao)}%${platform.criticos !== null ? ` e ${num(platform.criticos)}% dos itens são críticos` : ""}.`);
        return { id: `a:motivo:${m.key}`, label: m.label, count: m.count, pct: m.pct, of: "dos entrevistados", facts, prompts: WHY_PROMPTS[m.key] ?? [] };
      }),
    });
  }

  // 3. Quando saíram (tempo de casa).
  const tenure = i.tenure.filter((t) => t.count > 0);
  if (tenure.length > 0) {
    groups.push({
      id: "tempo",
      title: "Quando saíram (tempo de casa)",
      note: "Em quanto tempo de empresa a pessoa saiu. Saída precoce costuma apontar para seleção e integração.",
      branches: tenure.map((t) => ({
        id: `a:tempo:${squash(t.label)}`,
        label: t.label,
        count: t.count,
        pct: pctOf(t.count, i.total),
        of: "das saídas",
        facts: [],
        prompts: PROMPTS_BY_BUCKET[t.label] ?? [],
      })),
    });
  }

  // 4. Onde saíram.
  const where: CascadeBranch[] = [];
  for (const [key, name, list] of [["area", "Área", i.areas], ["turno", "Turno", i.turnos], ["cargo", "Cargo", i.cargos]] as const) {
    for (const item of list.slice(0, 3)) {
      if (item.count < 2) continue;
      where.push({
        id: `a:${key}:${squash(item.label)}`,
        label: `${name}: ${item.label}`,
        count: item.count,
        pct: pctOf(item.count, i.total),
        of: "das saídas",
        facts: [],
        prompts: [`O que é diferente em ${name.toLowerCase()} ${item.label} (liderança, escala, carga, ambiente) em relação ao resto da operação?`, "Esse ramo vem junto com algum dos motivos acima?"],
      });
    }
  }
  if (where.length > 0) groups.push({ id: "onde", title: "Onde saíram", note: "Concentração por área, turno e cargo (só aparece o que tem 2 saídas ou mais).", branches: where });

  // 5. Plataforma de entrevistas (tabelas somadas).
  const platform: CascadeBranch[] = [];
  const motivos = i.survey.motivos;
  if (motivos) {
    for (const row of motivos.rows) {
      const peak = row.values.reduce<number>((m, v) => Math.max(m, v ?? 0), 0);
      if (peak <= 0) continue;
      const parts = motivos.buckets.map((b, idx) => (row.values[idx] !== null ? `${b}: ${num(row.values[idx]!)}%` : null)).filter((x): x is string => x !== null);
      platform.push({
        id: `a:plat:${squash(row.motivo)}`,
        label: row.motivo,
        count: null,
        pct: peak,
        of: "no pico de uma faixa de tempo de casa",
        facts: [`Por tempo de casa — ${parts.join(" · ")}.`],
        prompts: ["Isso confirma o que as entrevistas por pessoa mostram ou aponta algo novo?", "Em qual faixa de tempo de casa pesa mais e o que acontece nesse momento da vida do colaborador na empresa?"],
      });
    }
  }
  const sat = i.survey.satisfacao;
  if (sat) {
    for (const row of [...sat.rows].filter((r) => r.satisfacao !== null).sort((a, b) => (a.satisfacao ?? 0) - (b.satisfacao ?? 0)).slice(0, 3)) {
      platform.push({
        id: `a:sat:${squash(row.categoria)}`,
        label: `Satisfação: ${row.categoria}`,
        count: null,
        pct: row.satisfacao,
        of: "de satisfação entre os que saíram",
        facts: [row.criticos !== null ? `${num(row.criticos)}% dos itens desta categoria foram marcados como críticos.` : "Nenhum item crítico nesta categoria."],
        prompts: ["O que, nesta categoria, a pessoa avaliou pior?", "Dá para comparar com a nota de quem ficou (pesquisa de clima)?"],
      });
    }
  }
  if (platform.length > 0) {
    const periods = [i.survey.motivosPeriod, i.survey.satisfacaoPeriod].filter(Boolean).join(" / ");
    groups.push({ id: "plataforma", title: "O que a plataforma de entrevistas aponta", note: `Tabelas somadas da plataforma externa${periods ? ` (${periods})` : ""}. Leitura de causa, sem contar pessoas.`, branches: platform });
  }

  return groups;
}

// ── Árvore das causas escritas pela pessoa ──

export const MAX_WHY_DEPTH = 5;

export const childrenOf = (causes: PdcaCause[], parentId: string | null) => causes.filter((c) => (c.parentId ?? null) === parentId);

/** Causas sem pai conhecido (ramo que sumiu dos dados, ou causas do formato antigo) ficam em "Outras causas". */
export function orphanCauses(causes: PdcaCause[], branchIds: Set<string>): PdcaCause[] {
  const ids = new Set(causes.map((c) => c.id));
  return causes.filter((c) => !c.parentId || (!ids.has(c.parentId) && !branchIds.has(c.parentId)));
}

export function descendantIds(causes: PdcaCause[], id: string): Set<string> {
  const out = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of causes) {
      if (c.parentId && out.has(c.parentId) && !out.has(c.id)) {
        out.add(c.id);
        grew = true;
      }
    }
  }
  return out;
}

/** Nível do "por quê?": 1 para a causa logo abaixo de um ramo dos dados, 2 para o porquê dela, e assim por diante. */
export function depthOf(causes: PdcaCause[], id: string): number {
  let depth = 1;
  let cur = causes.find((c) => c.id === id);
  while (cur?.parentId && depth < 20) {
    const parent = causes.find((c) => c.id === cur!.parentId);
    if (!parent) break;
    depth++;
    cur = parent;
  }
  return depth;
}

export type CascadeProgress = { branches: number; investigated: number; rootCauses: number; rootsWithoutAction: number };

/** Quantos ramos já foram desmembrados em causas, e quantas causas raiz ainda estão sem ação. `actionCauseIds` = causas que têm ao menos uma ação ligada. */
export function cascadeProgress(groups: CascadeGroup[], causes: PdcaCause[], actionCauseIds: Set<string>): CascadeProgress {
  const branchIds = groups.flatMap((g) => g.branches.map((b) => b.id));
  const roots = causes.filter((c) => c.root);
  return {
    branches: branchIds.length,
    investigated: branchIds.filter((id) => causes.some((c) => c.parentId === id)).length,
    rootCauses: roots.length,
    rootsWithoutAction: roots.filter((c) => !actionCauseIds.has(c.id)).length,
  };
}
