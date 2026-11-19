import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import { nextFriendlyCode } from "@/server/services/sequence";
import type { CurrentUser } from "@/server/auth/current-user";
import { ForbiddenError } from "@/server/auth/current-user";
import { parseSpreadsheet } from "@/lib/spreadsheet-import";
import { dueAtFrom, dpvimKindLabel, originGroupKey, supplierLabel } from "@/domain/dpvim/rules";
import { detectImportColumns, groupImportRows, importReference, materialToKind, splitSupplier, vimFromReference } from "@/domain/dpvim/import";
import { canLaunchDpvim, canSeeDpvimInvoice, listDpvimKinds, listDpvimSuppliers } from "@/server/services/dpvim.service";

export type DpvimImportRow = {
  vim: string;
  nfs: string[];
  supplierLabel: string;
  supplierName: string;
  supplierUnit: string | null;
  supplierIsNew: boolean;
  arrivedDay: string | null;
  items: { kind: string; label: string; qty: number }[];
  status: "create" | "exists" | "error";
  message: string | null;
};

/** Quem importa precisa lançar DPVIM e ver a nota: a planilha traz a quantidade da NOTA, que só quem tem esse acesso pode gravar. */
export async function canImportDpvim(user: CurrentUser): Promise<boolean> {
  return (await canLaunchDpvim(user)) && (await canSeeDpvimInvoice(user));
}

async function requireImportAccess(user: CurrentUser) {
  if (!(await canImportDpvim(user))) throw new ForbiddenError("Só quem lança DPVIM e vê a nota pode importar, porque a planilha traz a quantidade da nota.");
}

type Plan = { ok: true; rows: DpvimImportRow[]; suppliersReady: boolean } | { ok: false; error: string };

/** Lê a planilha e monta, por VIM, o que vai ser criado, o que já existe (pulado) e o que está com erro. Não grava nada. */
async function buildPlan(buffer: Buffer, filename: string): Promise<Plan> {
  const sheet = await parseSpreadsheet(buffer, filename);
  if (sheet.headers.length === 0) return { ok: false, error: "Não consegui ler nenhuma coluna nesse arquivo." };
  const detected = detectImportColumns(sheet.headers);
  if (!detected.ok) return { ok: false, error: `Faltam colunas na planilha: ${detected.missing.join(", ")}.` };
  const groups = groupImportRows(sheet.rows, detected.cols);
  if (groups.length === 0) return { ok: false, error: "Não encontrei nenhuma VIM na planilha." };

  const { kinds } = await listDpvimKinds();
  const { suppliers, ready } = await listDpvimSuppliers();
  const supplierKeys = new Set(suppliers.map((s) => originGroupKey(s.label)));
  const existing = new Map<string, string>();
  for (const d of await db.dpvim.findMany({ select: { code: true, reference: true } })) {
    const vim = vimFromReference(d.reference);
    if (vim) existing.set(vim, d.code);
  }

  const rows: DpvimImportRow[] = groups.map((g) => {
    const { name, unit } = splitSupplier(g.supplierRaw);
    const label = name ? supplierLabel(name, unit) : "";
    const errors = [...g.errors];
    const items: DpvimImportRow["items"] = [];
    for (const it of g.items) {
      const kind = materialToKind(it.material, kinds);
      if (!kind) errors.push(`Material não reconhecido: "${it.material}". Cadastre esse tipo em Tipos, ou corrija na planilha.`);
      else {
        const same = items.find((x) => x.kind === kind);
        if (same) same.qty += it.qty;
        else items.push({ kind, label: dpvimKindLabel(kind, kinds), qty: it.qty });
      }
    }
    if (g.arrivedDay && new Date(`${g.arrivedDay}T00:00:00-03:00`).getTime() > Date.now() + 60 * 60 * 1000) errors.push("A chegada não pode ser no futuro.");
    if (items.length === 0 && errors.length === 0) errors.push("Nenhum produto na VIM.");

    const base = { vim: g.vim, nfs: g.nfs, supplierLabel: label, supplierName: name, supplierUnit: unit, supplierIsNew: !!label && !supplierKeys.has(originGroupKey(label)), arrivedDay: g.arrivedDay, items };
    if (errors.length > 0) return { ...base, status: "error" as const, message: errors.join(" ") };
    const code = existing.get(g.vim);
    if (code) return { ...base, status: "exists" as const, message: `Já importada (${code}).` };
    return { ...base, status: "create" as const, message: null };
  });
  return { ok: true, rows, suppliersReady: ready };
}

export async function previewDpvimImport(user: CurrentUser, buffer: Buffer, filename: string) {
  await requireImportAccess(user);
  return buildPlan(buffer, filename);
}

/**
 * Cria as DPVIM novas da planilha (o que já foi importado fica de fora, então dá para rodar de novo sem duplicar). O fornecedor que ainda não existe é cadastrado
 * (nome e unidade); o que veio na planilha é a quantidade da NOTA, então vai para a nota de cada produto, e o "norte" do conferente fica sem contagem (0).
 */
export async function commitDpvimImport(user: CurrentUser, buffer: Buffer, filename: string) {
  await requireImportAccess(user);
  const plan = await buildPlan(buffer, filename);
  if (!plan.ok) throw new Error(plan.error);

  const supplierByKey = new Map((await listDpvimSuppliers()).suppliers.map((s) => [originGroupKey(s.label), s]));
  let created = 0;
  const failed: string[] = [];
  for (const r of plan.rows) {
    if (r.status !== "create" || !r.arrivedDay) continue;
    try {
      // Fornecedor: usa o cadastrado ou cadastra agora (nome e unidade). Sem a tabela de fornecedores, o texto vai direto em "De onde veio".
      const key = originGroupKey(r.supplierLabel);
      if (plan.suppliersReady && !supplierByKey.has(key)) {
        const row = await db.dpvimSupplier.create({ data: { name: r.supplierName.slice(0, 80), unit: r.supplierUnit ? r.supplierUnit.slice(0, 60) : null, key } });
        supplierByKey.set(key, { id: row.id, name: row.name, unit: row.unit, label: supplierLabel(row.name, row.unit), active: true });
        await recordAudit({ userId: user.id, action: "CREATE", entityType: "DpvimSupplier", entityId: row.id, newValue: { name: r.supplierName, unit: r.supplierUnit, viaImport: true } });
      }
      const origin = (supplierByKey.get(key)?.label ?? r.supplierLabel).slice(0, 120);
      const arrivedAt = new Date(`${r.arrivedDay}T00:00:00-03:00`);
      const code = await nextFriendlyCode("dpvim", "DPVIM", 4);
      const dpvim = await db.$transaction(async (tx) => {
        const d = await tx.dpvim.create({
          data: {
            code,
            kind: r.items[0].kind,
            origin,
            reference: importReference(r.vim, r.nfs),
            material: null,
            expectedQty: 0,
            arrivedAt,
            dueAt: dueAtFrom(arrivedAt),
            notes: null,
            createdById: user.id,
            createdByName: user.name,
          },
        });
        await tx.dpvimItem.createMany({ data: r.items.map((i, sort) => ({ dpvimId: d.id, kind: i.kind, expectedQty: 0, sort })) });
        await tx.dpvimItemInvoice.createMany({ data: r.items.map((i) => ({ dpvimId: d.id, kind: i.kind, qty: i.qty, updatedById: user.id, updatedByName: user.name })) });
        return d;
      });
      await recordAudit({ userId: user.id, action: "CREATE", entityType: "Dpvim", entityId: dpvim.id, newValue: { code, viaImport: true, vim: r.vim, nfs: r.nfs, origin, items: r.items } });
      created += 1;
    } catch (error) {
      console.error("[dpvim-import] falha ao importar a VIM", r.vim, error);
      failed.push(r.vim);
    }
  }
  return {
    created,
    skipped: plan.rows.filter((r) => r.status === "exists").length,
    errors: plan.rows.filter((r) => r.status === "error").length,
    failed,
  };
}
