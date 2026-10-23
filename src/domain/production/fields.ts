/**
 * Relatório de produção do turno — os mesmos campos da mensagem que o líder manda no WhatsApp ao fim do turno.
 * A chave (`key`) é o que fica guardado no banco; o rótulo pode mudar sem mexer nos dados.
 */

export type ProductionGroupKey = "GERAL" | "CARGAS" | "DESCARGAS" | "SELECAO";

export type ProductionField = {
  key: string;
  label: string;
  group: ProductionGroupKey;
  /** Aceita número negativo (ex.: ajuste de carros). */
  signed?: boolean;
  /** Não aparece nas telas (nem no formulário), mas a mensagem do WhatsApp ainda é reconhecida e o valor já guardado é mantido. */
  hidden?: boolean;
  /** Outros jeitos de escrever o rótulo na mensagem do WhatsApp (sem acento e minúsculo). */
  aliases?: string[];
};

export const PRODUCTION_GROUPS: { key: ProductionGroupKey; label: string; hint: string }[] = [
  { key: "GERAL", label: "Geral", hint: "Carros do turno e ocorrências" },
  { key: "CARGAS", label: "Cargas", hint: "O que foi carregado nos caminhões" },
  { key: "DESCARGAS", label: "Descargas", hint: "O que foi descarregado" },
  { key: "SELECAO", label: "Seleção e reforma (ajudantes)", hint: "Fechamento do turno dos ajudantes: pallets e chapas selecionados" },
];

export const PRODUCTION_FIELDS: ProductionField[] = [
  { key: "quedaProduto", label: "Queda de produto", group: "GERAL", aliases: ["queda produto", "queda de produto"] },
  { key: "absOperador", label: "ABS de operador", group: "GERAL", aliases: ["abs operador", "abs de operador", "abs operadores"] },
  { key: "carrosTrabalhados", label: "Carros trabalhados", group: "GERAL" },
  // Todo carro carregado é amarrado, e o controle por carro vem da planilha do TMA: o campo digitado só gerava divergência.
  { key: "carrosAmarrados", label: "Carros amarrados", group: "GERAL", hidden: true },
  { key: "carrosCarregados", label: "Carros carregados", group: "GERAL" },
  { key: "preCargaRodo", label: "Pré-carga rodo", group: "GERAL", aliases: ["pre carga rodo", "pre-carga rodo", "precarga rodo"] },
  { key: "preCargaTotal", label: "Pré-carga total", group: "GERAL", aliases: ["pre carga total", "pre-carga total", "precarga total"] },
  { key: "rodotrem", label: "Rodotrem", group: "GERAL" },
  { key: "frotaFixa", label: "Frota fixa", group: "GERAL" },
  { key: "filaCarregamento", label: "Fila de carregamento", group: "GERAL", aliases: ["fila carregamento", "fila de carregamento"] },
  { key: "ajusteCarros", label: "Ajuste de carros", group: "GERAL", signed: true, aliases: ["ajuste carros", "ajuste de carros"] },

  { key: "almoxCarregado", label: "Almox carregado", group: "CARGAS", aliases: ["almox carregado", "almoxarifado carregado"] },
  { key: "palletsCarregados", label: "Pallets carregados", group: "CARGAS", aliases: ["pallets carregados", "pallet carregados", "palete carregados"] },
  { key: "quadrosCarregados", label: "Quadros carregados", group: "CARGAS", aliases: ["quadros carregados", "quadro carregados"] },
  { key: "chapatexCarregados", label: "Chapatex carregados", group: "CARGAS", aliases: ["chapatex carregados", "chapatex carregado"] },
  { key: "bulksCarregados", label: "Bulks carregados", group: "CARGAS", aliases: ["bulks carregados", "bulk carregados", "bulks carregado"] },

  { key: "descargaBulk", label: "Bulk", group: "DESCARGAS", aliases: ["bulk", "bulks"] },
  { key: "descargaQuadro", label: "Quadro", group: "DESCARGAS", aliases: ["quadro", "quadros"] },
  { key: "descargaChapatex", label: "Chapatex", group: "DESCARGAS" },
  { key: "descargaPalletsDpvin", label: "Pallets DPVIN", group: "DESCARGAS", aliases: ["pallets dpvin", "pallet dpvin", "pallets", "dpvin"] },
  { key: "descargaInsumos", label: "Insumos", group: "DESCARGAS", aliases: ["insumos", "insumo"] },
  { key: "descargaDevolucoes", label: "Devoluções", group: "DESCARGAS", aliases: ["devolucoes", "devolucao"] },
  { key: "descargaAlmoxarifado", label: "Almoxarifado", group: "DESCARGAS", aliases: ["almoxarifado", "almox"] },

  { key: "selecaoPalletsSelecionados", label: "Pallets selecionados", group: "SELECAO" },
  { key: "selecaoChapasSelecionadas", label: "Chapas selecionadas", group: "SELECAO" },
  { key: "selecaoChapaDpvim", label: "Chapas DPVIM", group: "SELECAO" },
  { key: "selecaoTotalChapas", label: "Total de chapas", group: "SELECAO" },
  { key: "selecaoBom", label: "Bom", group: "SELECAO" },
  { key: "selecaoReforma", label: "Reforma", group: "SELECAO" },
  { key: "selecaoDescarte", label: "Descarte", group: "SELECAO" },
  { key: "selecaoTransferencia", label: "Chapas em transferência", group: "SELECAO" },
  { key: "selecaoQuebra", label: "Quebra", group: "SELECAO" },
];

export const PRODUCTION_FIELD_KEYS = PRODUCTION_FIELDS.map((f) => f.key);

export function fieldsOfGroup(group: ProductionGroupKey): ProductionField[] {
  return PRODUCTION_FIELDS.filter((f) => f.group === group && !f.hidden);
}

export type ProductionValues = Record<string, number>;

/** Só as chaves do catálogo e só números inteiros (os outros valores são descartados). */
export function sanitizeProductionValues(input: unknown): ProductionValues {
  const out: ProductionValues = {};
  if (!input || typeof input !== "object") return out;
  const raw = input as Record<string, unknown>;
  for (const field of PRODUCTION_FIELDS) {
    const v = raw[field.key];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const n = Math.round(v);
    if (n < 0 && !field.signed) continue;
    if (Math.abs(n) > 100000) continue;
    out[field.key] = n;
  }
  return out;
}

/** Total de descargas do turno (soma de todas as linhas do grupo DESCARGAS). */
export function totalOfGroup(values: ProductionValues, group: ProductionGroupKey): number {
  return fieldsOfGroup(group).reduce((sum, f) => sum + (values[f.key] ?? 0), 0);
}
