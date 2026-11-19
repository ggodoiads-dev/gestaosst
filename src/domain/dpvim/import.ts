import { originGroupKey } from "@/domain/dpvim/rules";

/**
 * Importação das DPVIM em aberto a partir da planilha "NF (Pendente VIM)": uma linha por NF e material, com
 * Dias em aberto, NF, VIM, Empresa/fornecedor, Cód ATG, Material, Quantidade, Data e Comentários.
 * A VIM é o número da DPVIM; a Quantidade é a da NOTA (fica só para quem vê a nota); o fornecedor vem como "Ambev S.A.F.<unidade>".
 */

export type ImportCols = { vim: number; nf: number; supplier: number; material: number; qty: number; date: number; comment: number };

const norm = originGroupKey;

/** Acha as colunas pelo nome do cabeçalho. Devolve o que faltou, se faltar algo obrigatório. */
export function detectImportColumns(headers: string[]): { ok: true; cols: ImportCols } | { ok: false; missing: string[] } {
  const find = (match: (h: string) => boolean) => headers.findIndex((h) => match(norm(h)));
  const cols = {
    vim: find((h) => h === "vim"),
    nf: find((h) => h === "nf"),
    supplier: find((h) => h.includes("fornecedor") || h.includes("empresa")),
    material: find((h) => h === "material"),
    qty: find((h) => h.includes("quantidade")),
    date: find((h) => h === "data"),
    comment: find((h) => h.startsWith("coment")),
  };
  const labels: Record<string, string> = { vim: "VIM", supplier: "Empresa/fornecedor", material: "Material", qty: "Quantidade", date: "Data" };
  const missing = (Object.keys(labels) as (keyof typeof labels)[]).filter((k) => cols[k as keyof typeof cols] < 0).map((k) => labels[k]);
  return missing.length > 0 ? { ok: false, missing } : { ok: true, cols };
}

/** "Ambev S.A.F.Santa Catarina" -> nome "Ambev" e unidade "Santa Catarina". Sem o "S.A.F.", tudo vira nome. */
export function splitSupplier(raw: string): { name: string; unit: string | null } {
  const text = raw.trim().replace(/\s+/g, " ");
  const m = /^(.*?)\s+S\.\s?A\.\s?F\.\s*(.*)$/i.exec(text);
  if (m && m[1].trim()) return { name: m[1].trim(), unit: m[2].trim() || null };
  return { name: text, unit: null };
}

const BUILTIN_MATERIALS: Record<string, string> = {
  pallet: "PALETE",
  pallets: "PALETE",
  palete: "PALETE",
  paletes: "PALETE",
  chapatex: "CHAPATEX",
  quadro: "QUADRO",
  quadros: "QUADRO",
};

/** O material da planilha vira o tipo da DPVIM (os de fábrica ou algum cadastrado em Tipos). `null` = não reconhecido. */
export function materialToKind(material: string, kinds: { key: string; label: string }[] = []): string | null {
  const key = norm(material);
  if (!key) return null;
  if (BUILTIN_MATERIALS[key]) return BUILTIN_MATERIALS[key];
  return kinds.find((k) => norm(k.label) === key)?.key ?? null;
}

/** "17/11/2026" -> "2026-11-17" (ou `null` se não for uma data válida). */
export function parseSheetDate(value: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Quantidade inteira positiva ("7040", "7.040", " 22 "); `null` se não for. */
export function parseSheetQty(value: string): number | null {
  let v = value.trim().replace(/\s+/g, "");
  if (/^\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, "");
  if (!/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n > 0 && n <= 1_000_000 ? n : null;
}

export type ImportGroup = {
  /** Número da VIM (a DPVIM). */
  vim: string;
  nfs: string[];
  supplierRaw: string;
  /** Dia da chegada (AAAA-MM-DD). */
  arrivedDay: string | null;
  items: { material: string; qty: number }[];
  comments: string[];
  /** Linhas da planilha (a contar do cabeçalho como 1). */
  rows: number[];
  errors: string[];
};

/** Junta as linhas por VIM: o fornecedor e a data são os mesmos; cada material vira um produto (somando as NFs); linhas sem VIM (rodapé, vazias) são ignoradas. */
export function groupImportRows(rows: string[][], cols: ImportCols): ImportGroup[] {
  const groups = new Map<string, ImportGroup>();
  rows.forEach((row, i) => {
    const cell = (c: number) => (c >= 0 ? String(row[c] ?? "").trim() : "");
    const vim = cell(cols.vim);
    if (!vim) return;
    const lineNo = i + 2;
    const g = groups.get(vim) ?? { vim, nfs: [], supplierRaw: "", arrivedDay: null, items: [], comments: [], rows: [], errors: [] };
    groups.set(vim, g);
    g.rows.push(lineNo);

    const nf = cell(cols.nf);
    if (nf && !g.nfs.includes(nf)) g.nfs.push(nf);

    const supplier = cell(cols.supplier);
    if (!supplier) g.errors.push(`Linha ${lineNo}: sem fornecedor.`);
    else if (!g.supplierRaw) g.supplierRaw = supplier;
    else if (norm(g.supplierRaw) !== norm(supplier)) g.errors.push(`Linha ${lineNo}: a mesma VIM aparece com fornecedores diferentes.`);

    const dateText = cell(cols.date);
    const day = parseSheetDate(dateText);
    if (!day) g.errors.push(`Linha ${lineNo}: data inválida (${dateText || "vazia"}).`);
    else if (!g.arrivedDay) g.arrivedDay = day;
    else if (g.arrivedDay !== day) g.errors.push(`Linha ${lineNo}: a mesma VIM aparece com datas diferentes.`);

    const material = cell(cols.material);
    const qty = parseSheetQty(cell(cols.qty));
    if (!material) g.errors.push(`Linha ${lineNo}: sem material.`);
    else if (qty === null) g.errors.push(`Linha ${lineNo}: quantidade inválida (${cell(cols.qty) || "vazia"}).`);
    else {
      const same = g.items.find((it) => norm(it.material) === norm(material));
      if (same) same.qty += qty;
      else g.items.push({ material, qty });
    }

    const comment = cell(cols.comment);
    if (comment && !g.comments.includes(comment)) g.comments.push(comment);
  });
  return [...groups.values()];
}

/** O número da VIM guardado no campo "Número / nota / placa" da DPVIM ("VIM 7018780 · NF 454592-1"); serve para não importar a mesma VIM duas vezes. */
export function vimFromReference(reference: string | null | undefined): string | null {
  const m = /^VIM\s+(\d+)/i.exec((reference ?? "").trim());
  return m ? m[1] : null;
}

export function importReference(vim: string, nfs: string[]): string {
  return nfs.length > 0 ? `VIM ${vim} · NF ${nfs.join(", ")}` : `VIM ${vim}`;
}
