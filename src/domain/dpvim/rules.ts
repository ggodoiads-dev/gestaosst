/** DPVIM: carga de retorno (≈420 paletes intercalados com chapatex) que precisa ser selecionada e separada em até 48h da chegada. */

export const DPVIM_DEADLINE_HOURS = 48;
export const DPVIM_SOON_HOURS = 12;

/** Tipos que já vêm de fábrica. Os outros o usuário cadastra (tabela DpvimKindDef) e ficam junto com estes. */
export const DPVIM_KINDS = [
  { key: "PALETE", label: "Palete" },
  { key: "CHAPATEX", label: "Chapatex" },
  { key: "QUADRO", label: "Quadro" },
] as const;
export type DpvimKind = string;

export type DpvimKindOption = { key: string; label: string; builtin: boolean; active: boolean; id: string | null };

export function dpvimKindLabel(kind: string, kinds: { key: string; label: string }[] = []): string {
  return kinds.find((k) => k.key === kind)?.label ?? DPVIM_KINDS.find((k) => k.key === kind)?.label ?? kind;
}

/** Chave de um tipo cadastrado: "c-" + o nome sem acento, em minúsculas e com hífens. */
export function kindKeyFromLabel(label: string): string {
  const slug = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug ? `c-${slug}` : "";
}

/** Saldo da conferência: o que foi contado menos o que a nota dizia. Negativo = faltou, positivo = sobrou, 0 = bateu. Só vale para DPVIM concluída. */
export function dpvimBalance(doneQty: number, expectedQty: number): number {
  return doneQty - expectedQty;
}

/** Nome do fornecedor para agrupar: sem espaços sobrando, sem acento e sem diferença de maiúsculas ("Ambev " = "ambev"). */
export function originGroupKey(origin: string): string {
  return origin.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export type DpvimStatus = "ABERTA" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA";

/** Prazo de rebater: 48h a partir da chegada. */
export function dueAtFrom(arrivedAt: Date): Date {
  return new Date(arrivedAt.getTime() + DPVIM_DEADLINE_HOURS * 60 * 60 * 1000);
}

export type DpvimSituation = "ATRASADA" | "VENCE_LOGO" | "NO_PRAZO" | "CONCLUIDA_NO_PRAZO" | "CONCLUIDA_ATRASADA" | "CANCELADA";

export const DPVIM_SITUATION_LABEL: Record<DpvimSituation, string> = {
  ATRASADA: "Atrasada",
  VENCE_LOGO: "Vence em breve",
  NO_PRAZO: "No prazo",
  CONCLUIDA_NO_PRAZO: "Concluída no prazo",
  CONCLUIDA_ATRASADA: "Concluída com atraso",
  CANCELADA: "Cancelada",
};

/** Situação de uma DPVIM frente ao prazo de 48h. `hoursLeft` é negativo quando já passou do prazo (só para as não concluídas). */
export function dpvimSituation(d: { status: DpvimStatus; dueAt: Date; finishedAt: Date | null }, now: Date): { situation: DpvimSituation; hoursLeft: number | null } {
  if (d.status === "CANCELADA") return { situation: "CANCELADA", hoursLeft: null };
  if (d.status === "CONCLUIDA") {
    const late = d.finishedAt !== null && d.finishedAt.getTime() > d.dueAt.getTime();
    return { situation: late ? "CONCLUIDA_ATRASADA" : "CONCLUIDA_NO_PRAZO", hoursLeft: null };
  }
  const hoursLeft = (d.dueAt.getTime() - now.getTime()) / (60 * 60 * 1000);
  if (hoursLeft < 0) return { situation: "ATRASADA", hoursLeft };
  return { situation: hoursLeft <= DPVIM_SOON_HOURS ? "VENCE_LOGO" : "NO_PRAZO", hoursLeft };
}

/** "3h 20min" / "1d 4h" / "45min" a partir de horas (valor absoluto). */
export function formatHours(hours: number): string {
  const total = Math.round(Math.abs(hours) * 60);
  const d = Math.floor(total / (24 * 60));
  const h = Math.floor((total % (24 * 60)) / 60);
  const m = total % 60;
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m > 0 ? `${h}h ${String(m).padStart(2, "0")}min` : `${h}h`;
  return `${m}min`;
}

/** Interpreta um "AAAA-MM-DDTHH:mm" digitado no horário de Brasília como o instante correto. */
export function parseBrasiliaLocal(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Percentual feito da carga (limitado a 100). */
export function progressPercent(done: number, expected: number): number {
  if (expected <= 0) return 0;
  return Math.min(100, Math.round((done / expected) * 100));
}

/** Um produto dentro da DPVIM: o "norte" do conferente, o que os ajudantes contaram e, para quem vê a nota, a nota e a diferença. */
export type DpvimLine = {
  kind: string;
  /** Contagem do conferente na chegada: só um norte, não é limite (os ajudantes podem contar mais ou menos). */
  expected: number;
  /** Soma do que os ajudantes contaram nesse produto. */
  done: number;
  /** Dos que foram contados desse produto, quantos foram bons, quantos transferência e quantos descarte (somando todas as atividades). */
  good: number;
  transfer: number;
  discard: number;
  /** Quantidade da nota (só para quem tem acesso a ela, e depois de informada). */
  invoice: number | null;
  /** Contado pelos ajudantes menos a nota, só depois de concluída e com a nota informada. Negativo = faltou, positivo = sobrou. */
  balance: number | null;
};

/**
 * Monta as linhas (um produto por linha) de uma DPVIM. Sem itens cadastrados (DPVIM antiga), vale o tipo e a quantidade únicos de antes.
 * Entram também tipos que só apareceram na contagem dos ajudantes ou na nota (norte 0), para nada sumir da conta.
 */
export function buildLines(p: {
  legacyKind: string;
  legacyExpected: number;
  items: { kind: string; expectedQty: number }[];
  doneByKind: Map<string, number>;
  qualityByKind?: Map<string, { good: number; transfer: number; discard: number }>;
  invoiceByKind: Map<string, number> | null;
  concluded: boolean;
}): DpvimLine[] {
  const base = p.items.length > 0 ? p.items : [{ kind: p.legacyKind, expectedQty: p.legacyExpected }];
  const order: string[] = [];
  const expected = new Map<string, number>();
  for (const it of base) {
    if (!expected.has(it.kind)) order.push(it.kind);
    expected.set(it.kind, (expected.get(it.kind) ?? 0) + it.expectedQty);
  }
  for (const k of [...p.doneByKind.keys(), ...(p.invoiceByKind ? [...p.invoiceByKind.keys()] : [])]) {
    if (!expected.has(k)) {
      order.push(k);
      expected.set(k, 0);
    }
  }
  return order.map((kind) => {
    const done = p.doneByKind.get(kind) ?? 0;
    const invoice = p.invoiceByKind?.get(kind) ?? null;
    const q = p.qualityByKind?.get(kind);
    return { kind, expected: expected.get(kind) ?? 0, done, good: q?.good ?? 0, transfer: q?.transfer ?? 0, discard: q?.discard ?? 0, invoice, balance: p.concluded && invoice !== null ? dpvimBalance(done, invoice) : null };
  });
}

/** Fornecedor cadastrado (nome e unidade). `label` é o que aparece e o que fica gravado em "De onde veio" de cada DPVIM. */
export type DpvimSupplierOption = { id: string; name: string; unit: string | null; label: string; active: boolean };

/** "Ambev · Jaguariúna" (com unidade) ou só "Ambev". */
export function supplierLabel(name: string, unit?: string | null): string {
  const n = name.trim().replace(/\s+/g, " ");
  const u = (unit ?? "").trim().replace(/\s+/g, " ");
  return u ? `${n} · ${u}` : n;
}

/** Chave para comparar fornecedores sem se importar com maiúsculas, acento e espaços. */
export function supplierKey(name: string, unit?: string | null): string {
  return originGroupKey(supplierLabel(name, unit));
}

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Fornecedores já cadastrados com nome parecido (erro de digitação, nome contido no outro). Mesmo nome com outra unidade NÃO conta: é normal ter várias unidades. */
export function similarSuppliers(name: string, list: { label: string; name: string }[]): string[] {
  const nk = originGroupKey(name);
  if (nk.length < 3) return [];
  return list
    .filter((s) => {
      const sk = originGroupKey(s.name);
      if (sk === nk) return false;
      return Math.min(sk.length, nk.length) >= 4 && (sk.includes(nk) || nk.includes(sk) || editDistance(sk, nk) <= 2);
    })
    .map((s) => s.label);
}
