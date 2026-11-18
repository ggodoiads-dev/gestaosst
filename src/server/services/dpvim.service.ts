import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import { nextFriendlyCode } from "@/server/services/sequence";
import { deleteStoredFile } from "@/server/services/storage";
import type { CurrentUser } from "@/server/auth/current-user";
import { ForbiddenError, hasPermission, requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { APP_TIMEZONE } from "@/lib/dates";
import { DPVIM_KINDS, buildLines, dpvimKindLabel, dpvimSituation, dueAtFrom, kindKeyFromLabel, originGroupKey, progressPercent, supplierLabel, type DpvimKind, type DpvimKindOption, type DpvimLine, type DpvimSupplierOption, type DpvimSituation, type DpvimStatus } from "@/domain/dpvim/rules";

/** Quem cadastra, edita e cancela DPVIM e vê o painel completo: gestão de produtividade, líderes que fazem chamada. */
export function canManageDpvim(user: CurrentUser): boolean {
  return hasPermission(user, PERMISSIONS.PRODUCTIVITY_MANAGE) || hasPermission(user, PERMISSIONS.PRODUCTIVITY_MANAGE_TEAM) || user.canRollCall;
}

/** Quem só acompanha o painel (auditor, RH, indicadores consolidados). */
export function canViewDpvimDashboard(user: CurrentUser): boolean {
  return canManageDpvim(user) || hasPermission(user, PERMISSIONS.PRODUCTIVITY_VIEW) || hasPermission(user, PERMISSIONS.INDICATORS_VIEW_CONSOLIDATED);
}

/** Liberado pelo administrador (Usuários e Permissões) para lançar DPVIM. Leitura tolerante: se a tabela ainda não existe, ninguém é liberado por ela. */
export async function hasDpvimLaunchGrant(userId: string): Promise<boolean> {
  try {
    return !!(await db.dpvimLaunchAccess.findUnique({ where: { userId } }));
  } catch (error) {
    console.error("[dpvim] tabela de liberação indisponível:", error);
    return false;
  }
}

/** Quem pode cadastrar, editar e cancelar DPVIM: a gestão/líderes, ou quem o administrador liberou. (Excluir e cadastrar tipos continuam só com a gestão.) */
export async function canLaunchDpvim(user: CurrentUser): Promise<boolean> {
  return canManageDpvim(user) || (await hasDpvimLaunchGrant(user.id));
}

/** Os usuários liberados (para abrir a edição de usuário já marcada). */
export async function listDpvimLaunchGrants(): Promise<Set<string>> {
  try {
    return new Set((await db.dpvimLaunchAccess.findMany({ select: { userId: true } })).map((r) => r.userId));
  } catch (error) {
    console.error("[dpvim] tabela de liberação indisponível:", error);
    return new Set();
  }
}

export async function setDpvimLaunchGrant(admin: CurrentUser, userId: string, granted: boolean) {
  requirePermission(admin, PERMISSIONS.USER_MANAGE);
  const has = await hasDpvimLaunchGrant(userId);
  if (granted === has) return;
  if (granted) await db.dpvimLaunchAccess.create({ data: { userId } });
  else await db.dpvimLaunchAccess.deleteMany({ where: { userId } });
  await recordAudit({ userId: admin.id, action: "UPDATE", entityType: "DpvimLaunchAccess", entityId: userId, previousValue: { granted: has }, newValue: { granted } });
}

/** Pode ver a quantidade da nota e as divergências (saldo, falta, sobra): administrador e gestor pelo perfil, e quem o administrador liberou. Quem só lança conta sem ver a nota. */
export async function canSeeDpvimInvoice(user: CurrentUser): Promise<boolean> {
  if (user.roleKey === "ADMINISTRADOR" || user.roleKey === "GESTOR") return true;
  try {
    return !!(await db.dpvimInvoiceAccess.findUnique({ where: { userId: user.id } }));
  } catch (error) {
    console.error("[dpvim] tabela de acesso à nota indisponível:", error);
    return false;
  }
}

export async function listDpvimInvoiceGrants(): Promise<Set<string>> {
  try {
    return new Set((await db.dpvimInvoiceAccess.findMany({ select: { userId: true } })).map((r) => r.userId));
  } catch (error) {
    console.error("[dpvim] tabela de acesso à nota indisponível:", error);
    return new Set();
  }
}

export async function setDpvimInvoiceGrant(admin: CurrentUser, userId: string, granted: boolean) {
  requirePermission(admin, PERMISSIONS.USER_MANAGE);
  const has = (await listDpvimInvoiceGrants()).has(userId);
  if (granted === has) return;
  if (granted) await db.dpvimInvoiceAccess.create({ data: { userId } });
  else await db.dpvimInvoiceAccess.deleteMany({ where: { userId } });
  await recordAudit({ userId: admin.id, action: "UPDATE", entityType: "DpvimInvoiceAccess", entityId: userId, previousValue: { granted: has }, newValue: { granted } });
}

async function myCollaborator(user: CurrentUser) {
  return db.collaborator.findUnique({ where: { userId: user.id }, select: { id: true, name: true } });
}

/** Acesso à tela: gestão, quem acompanha, ou qualquer colaborador com login (o ajudante que executa). */
async function requireDpvimAccess(user: CurrentUser) {
  if (canManageDpvim(user) || canViewDpvimDashboard(user) || (await hasDpvimLaunchGrant(user.id))) return null;
  const me = await myCollaborator(user);
  if (!me) throw new ForbiddenError();
  return me;
}

/** Tipos disponíveis: os de fábrica mais os cadastrados. Se a tabela de tipos ainda não existe, só os de fábrica (nada quebra). */
export async function listDpvimKinds(): Promise<{ kinds: DpvimKindOption[]; ready: boolean }> {
  const builtin: DpvimKindOption[] = DPVIM_KINDS.map((k) => ({ key: k.key, label: k.label, builtin: true, active: true, id: null }));
  try {
    const custom = await db.dpvimKindDef.findMany({ orderBy: { label: "asc" } });
    return { kinds: [...builtin, ...custom.map((c) => ({ key: c.key, label: c.label, builtin: false, active: c.active, id: c.id }))], ready: true };
  } catch (error) {
    console.error("[dpvim] tabela de tipos indisponível:", error);
    return { kinds: builtin, ready: false };
  }
}

export async function createDpvimKind(user: CurrentUser, label: string) {
  if (!canManageDpvim(user)) throw new ForbiddenError();
  const clean = label.trim().replace(/\s+/g, " ").slice(0, 40);
  if (clean.length < 2) throw new Error("Informe o nome do tipo.");
  const key = kindKeyFromLabel(clean);
  if (!key) throw new Error("Informe o nome do tipo com letras ou números.");
  const { kinds } = await listDpvimKinds();
  if (kinds.some((k) => k.key === key || k.label.toLowerCase() === clean.toLowerCase())) throw new Error("Já existe um tipo com esse nome.");
  const created = await db.dpvimKindDef.create({ data: { key, label: clean } });
  await recordAudit({ userId: user.id, action: "CREATE", entityType: "DpvimKindDef", entityId: created.id, newValue: { key, label: clean } });
  return created;
}

/** Tipo cadastrado que não vai mais ser usado some das opções de novo cadastro, mas as DPVIM antigas continuam com o nome dele. */
export async function setDpvimKindActive(user: CurrentUser, id: string, active: boolean) {
  if (!canManageDpvim(user)) throw new ForbiddenError();
  const before = await db.dpvimKindDef.findUniqueOrThrow({ where: { id } });
  await db.dpvimKindDef.update({ where: { id }, data: { active } });
  await recordAudit({ userId: user.id, action: "UPDATE", entityType: "DpvimKindDef", entityId: id, previousValue: { active: before.active }, newValue: { active } });
}

/** Fornecedores cadastrados (nome e unidade). Se a tabela ainda não existe, nenhum: "De onde veio" segue como texto livre (nada quebra). */
export async function listDpvimSuppliers(): Promise<{ suppliers: DpvimSupplierOption[]; ready: boolean }> {
  try {
    const rows = await db.dpvimSupplier.findMany({ orderBy: { name: "asc" } });
    return { suppliers: rows.map((r) => ({ id: r.id, name: r.name, unit: r.unit, label: supplierLabel(r.name, r.unit), active: r.active })), ready: true };
  } catch (error) {
    console.error("[dpvim] tabela de fornecedores indisponível:", error);
    return { suppliers: [], ready: false };
  }
}

function cleanSupplier(name: string, unit: string | null | undefined) {
  const n = name.trim().replace(/\s+/g, " ").slice(0, 80);
  const u = (unit ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
  if (n.length < 2) throw new Error("Informe o nome do fornecedor.");
  return { name: n, unit: u ? u : null };
}

/** Passa para o nome cadastrado todas as DPVIM que tinham esse fornecedor digitado (ou escrito de outro jeito: maiúsculas, acento, espaços). */
async function retargetOrigins(fromKey: string, toLabel: string) {
  const rows = await db.dpvim.findMany({ select: { id: true, origin: true } });
  const ids = rows.filter((r) => originGroupKey(r.origin) === fromKey && r.origin !== toLabel).map((r) => r.id);
  if (ids.length > 0) await db.dpvim.updateMany({ where: { id: { in: ids } }, data: { origin: toLabel } });
  return ids.length;
}

/** Quem lança pode cadastrar o fornecedor na hora; editar, desativar e unir ficam com a gestão. */
export async function createDpvimSupplier(user: CurrentUser, input: { name: string; unit: string | null }) {
  if (!(await canLaunchDpvim(user))) throw new ForbiddenError();
  const { name, unit } = cleanSupplier(input.name, input.unit);
  const label = supplierLabel(name, unit);
  const key = originGroupKey(label);
  const { suppliers } = await listDpvimSuppliers();
  if (suppliers.some((s) => originGroupKey(s.label) === key)) throw new Error("Já existe esse fornecedor (mesmo nome e unidade). Ele pode estar desativado.");
  const created = await db.dpvimSupplier.create({ data: { name, unit, key } });
  // DPVIM antigas digitadas do mesmo jeito passam a usar o nome cadastrado.
  await retargetOrigins(key, label);
  await recordAudit({ userId: user.id, action: "CREATE", entityType: "DpvimSupplier", entityId: created.id, newValue: { name, unit } });
  return { id: created.id, label };
}

export async function updateDpvimSupplier(user: CurrentUser, id: string, input: { name: string; unit: string | null }) {
  if (!canManageDpvim(user)) throw new ForbiddenError();
  const before = await db.dpvimSupplier.findUniqueOrThrow({ where: { id } });
  const { name, unit } = cleanSupplier(input.name, input.unit);
  const label = supplierLabel(name, unit);
  const key = originGroupKey(label);
  const other = await db.dpvimSupplier.findUnique({ where: { key } });
  if (other && other.id !== id) throw new Error("Já existe outro fornecedor com esse nome e unidade. Use \"Unir\" para juntar os dois.");
  await db.dpvimSupplier.update({ where: { id }, data: { name, unit, key } });
  // As DPVIM que usavam o nome antigo passam para o novo.
  await retargetOrigins(before.key, label);
  await recordAudit({ userId: user.id, action: "UPDATE", entityType: "DpvimSupplier", entityId: id, previousValue: { name: before.name, unit: before.unit }, newValue: { name, unit } });
}

/** Fornecedor desativado some das opções de novo cadastro, mas as DPVIM dele continuam como estão. */
export async function setDpvimSupplierActive(user: CurrentUser, id: string, active: boolean) {
  if (!canManageDpvim(user)) throw new ForbiddenError();
  const before = await db.dpvimSupplier.findUniqueOrThrow({ where: { id } });
  await db.dpvimSupplier.update({ where: { id }, data: { active } });
  await recordAudit({ userId: user.id, action: "UPDATE", entityType: "DpvimSupplier", entityId: id, previousValue: { active: before.active }, newValue: { active } });
}

/** Junta dois fornecedores: todas as DPVIM de `fromId` passam para `intoId` e o primeiro sai da lista. */
export async function mergeDpvimSupplier(user: CurrentUser, fromId: string, intoId: string) {
  if (!canManageDpvim(user)) throw new ForbiddenError();
  if (fromId === intoId) throw new Error("Escolha outro fornecedor para unir.");
  const from = await db.dpvimSupplier.findUniqueOrThrow({ where: { id: fromId } });
  const into = await db.dpvimSupplier.findUniqueOrThrow({ where: { id: intoId } });
  const moved = await retargetOrigins(from.key, supplierLabel(into.name, into.unit));
  await db.dpvimSupplier.delete({ where: { id: fromId } });
  await recordAudit({ userId: user.id, action: "UPDATE", entityType: "DpvimSupplier", entityId: fromId, previousValue: { name: from.name, unit: from.unit }, newValue: { mergedInto: intoId, moved } });
  return { moved };
}

export type DpvimSupplierOverview = DpvimSupplierOption & { total: number; open: number; late: number; lastArrivedAt: Date | null };

/** Para a aba de fornecedores: cada fornecedor com quantas DPVIM tem (e quantas em aberto/atrasadas), e os nomes já usados que ainda não foram cadastrados. Só gestão. */
export async function getDpvimSuppliersOverview(user: CurrentUser) {
  if (!canManageDpvim(user)) throw new ForbiddenError();
  const { suppliers, ready } = await listDpvimSuppliers();
  const dpvims = await db.dpvim.findMany({ select: { origin: true, status: true, dueAt: true, arrivedAt: true } }).catch(() => []);
  const now = Date.now();
  const stats = new Map<string, { total: number; open: number; late: number; last: Date | null; origin: string }>();
  for (const d of dpvims) {
    if (d.status === "CANCELADA") continue;
    const k = originGroupKey(d.origin);
    const e = stats.get(k) ?? { total: 0, open: 0, late: 0, last: null, origin: d.origin };
    e.total += 1;
    const open = d.status === "ABERTA" || d.status === "EM_ANDAMENTO";
    if (open) e.open += 1;
    if (open && d.dueAt.getTime() < now) e.late += 1;
    if (!e.last || d.arrivedAt > e.last) e.last = d.arrivedAt;
    stats.set(k, e);
  }
  const registered = new Set(suppliers.map((s) => originGroupKey(s.label)));
  return {
    ready,
    suppliers: suppliers.map((s): DpvimSupplierOverview => {
      const e = stats.get(originGroupKey(s.label));
      return { ...s, total: e?.total ?? 0, open: e?.open ?? 0, late: e?.late ?? 0, lastArrivedAt: e?.last ?? null };
    }),
    unregistered: [...stats.entries()].filter(([k]) => !registered.has(k)).map(([, e]) => ({ origin: e.origin, count: e.total })).sort((a, b) => b.count - a.count),
  };
}

export type DpvimRow = {
  id: string;
  code: string;
  /** Tipo do primeiro produto (resumo); o que vale é `lines`. */
  kind: DpvimKind;
  origin: string;
  reference: string | null;
  material: string | null;
  /** Um produto por linha: norte do conferente, contagem dos ajudantes e, para quem vê a nota, a nota e a diferença. */
  lines: DpvimLine[];
  /** Soma do norte do conferente (contagem na chegada, só uma referência). */
  expectedQty: number;
  /** Soma do que os ajudantes já contaram. */
  doneQty: number;
  /** Só para quem vê a nota: soma das diferenças (contado pelos ajudantes menos a nota) dos produtos com a nota informada, depois de concluída. */
  balance: number | null;
  progress: number;
  arrivedAt: Date;
  dueAt: Date;
  status: DpvimStatus;
  situation: DpvimSituation;
  hoursLeft: number | null;
  finishedAt: Date | null;
  notes: string | null;
  sessionsCount: number;
  /** Quem abriu primeiro e quando. */
  firstOpenedBy: { name: string; at: Date } | null;
  /** Quem está com ela aberta agora. */
  openNow: { name: string; partnerName: string | null; since: Date }[];
};

export type DpvimSessionRow = {
  id: string;
  dpvimId: string;
  dpvimCode: string;
  workerName: string;
  partnerName: string | null;
  startedAt: Date;
  stoppedAt: Date | null;
  photoPath: string;
  qtyDone: number | null;
  /** O que contaram de cada produto nessa atividade (vazio nas atividades antigas, de um produto só), e como ficou: bons, transferência e descarte (`null` = não informado). */
  byKind: { kind: string; qty: number; good: number | null; transfer: number | null; discard: number | null }[];
  qtyGood: number | null;
  qtyTransfer: number | null;
  qtyDiscard: number | null;
  notes: string | null;
};

type DpvimDb = Awaited<ReturnType<typeof db.dpvim.findMany>>[number];
type SessionDb = Awaited<ReturnType<typeof db.dpvimSession.findMany>>[number];
type ItemData = {
  items: { dpvimId: string; kind: string; expectedQty: number; sort: number }[];
  sessionItems: { sessionId: string; dpvimId: string; kind: string; qty: number }[];
  quality: { sessionId: string; dpvimId: string; kind: string; good: number; transfer: number; discard: number }[];
  /** `null` = quem vê não tem acesso à nota (as notas nem são lidas). */
  invoice: { dpvimId: string; kind: string; qty: number }[] | null;
};

/** Produtos, contagem por produto e notas das DPVIM. Leitura tolerante: se as tabelas novas ainda não existem, tudo vale como antes (um produto só). */
async function loadItemData(dpvimIds: string[], showInvoice: boolean): Promise<ItemData> {
  const data: ItemData = { items: [], sessionItems: [], quality: [], invoice: showInvoice ? [] : null };
  try {
    data.items = await db.dpvimItem.findMany({ where: { dpvimId: { in: dpvimIds } }, orderBy: { sort: "asc" } });
    data.sessionItems = await db.dpvimSessionItem.findMany({ where: { dpvimId: { in: dpvimIds } } });
  } catch (error) {
    console.error("[dpvim] tabelas de produtos indisponíveis:", error);
  }
  try {
    data.quality = await db.dpvimSessionQuality.findMany({ where: { dpvimId: { in: dpvimIds } } });
  } catch (error) {
    console.error("[dpvim] tabela de bons/transferência/descarte indisponível:", error);
  }
  if (showInvoice) {
    try {
      data.invoice = await db.dpvimItemInvoice.findMany({ where: { dpvimId: { in: dpvimIds } } });
    } catch (error) {
      console.error("[dpvim] tabela de notas indisponível:", error);
    }
  }
  return data;
}

function toRow(d: DpvimDb, sessions: SessionDb[], now: Date, data: ItemData): DpvimRow {
  const status = d.status as DpvimStatus;
  const { situation, hoursLeft } = dpvimSituation({ status, dueAt: d.dueAt, finishedAt: d.finishedAt }, now);
  const mine = sessions.filter((s) => s.dpvimId === d.id).sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());

  const doneByKind = new Map<string, number>();
  const withItems = new Set<string>();
  for (const si of data.sessionItems) {
    if (si.dpvimId !== d.id) continue;
    withItems.add(si.sessionId);
    doneByKind.set(si.kind, (doneByKind.get(si.kind) ?? 0) + si.qty);
  }
  // Atividades antigas (de um produto só) não têm contagem por produto: o que fizeram vale para o tipo da DPVIM.
  for (const s of mine) {
    if (s.stoppedAt && (s.qtyDone ?? 0) > 0 && !withItems.has(s.id)) doneByKind.set(d.kind, (doneByKind.get(d.kind) ?? 0) + (s.qtyDone ?? 0));
  }
  // Bons, transferência e descarte por produto. Atividades antigas (sem a divisão por produto) valem para o tipo da DPVIM.
  const qualityByKind = new Map<string, { good: number; transfer: number; discard: number }>();
  const addQuality = (kind: string, good: number, transfer: number, discard: number) => {
    const q = qualityByKind.get(kind) ?? { good: 0, transfer: 0, discard: 0 };
    q.good += good;
    q.transfer += transfer;
    q.discard += discard;
    qualityByKind.set(kind, q);
  };
  const withQuality = new Set<string>();
  for (const q of data.quality) {
    if (q.dpvimId !== d.id) continue;
    withQuality.add(q.sessionId);
    addQuality(q.kind, q.good, q.transfer, q.discard);
  }
  for (const s of mine) {
    if (s.stoppedAt && !withQuality.has(s.id) && (s.qtyGood !== null || s.qtyTransfer !== null || s.qtyDiscard !== null)) addQuality(d.kind, s.qtyGood ?? 0, s.qtyTransfer ?? 0, s.qtyDiscard ?? 0);
  }
  const invoiceByKind = data.invoice ? new Map(data.invoice.filter((i) => i.dpvimId === d.id).map((i) => [i.kind, i.qty] as const)) : null;
  const lines = buildLines({
    legacyKind: d.kind,
    legacyExpected: d.expectedQty,
    items: data.items.filter((i) => i.dpvimId === d.id),
    doneByKind,
    qualityByKind,
    invoiceByKind,
    concluded: status === "CONCLUIDA",
  });
  const known = lines.filter((l) => l.balance !== null);
  const expectedQty = lines.reduce((s, l) => s + l.expected, 0);
  return {
    id: d.id,
    code: d.code,
    kind: d.kind as DpvimKind,
    origin: d.origin,
    reference: d.reference,
    material: d.material,
    lines,
    expectedQty,
    doneQty: d.doneQty,
    balance: known.length > 0 ? known.reduce((s, l) => s + (l.balance ?? 0), 0) : null,
    progress: progressPercent(d.doneQty, expectedQty),
    arrivedAt: d.arrivedAt,
    dueAt: d.dueAt,
    status,
    situation,
    hoursLeft,
    finishedAt: d.finishedAt,
    notes: d.notes,
    sessionsCount: mine.length,
    firstOpenedBy: mine[0] ? { name: mine[0].workerName, at: mine[0].startedAt } : null,
    openNow: mine.filter((s) => !s.stoppedAt).map((s) => ({ name: s.workerName, partnerName: s.partnerName, since: s.startedAt })),
  };
}

function toSessionRow(s: SessionDb, code: string, data: ItemData): DpvimSessionRow {
  return {
    id: s.id,
    dpvimId: s.dpvimId,
    dpvimCode: code,
    workerName: s.workerName,
    partnerName: s.partnerName,
    startedAt: s.startedAt,
    stoppedAt: s.stoppedAt,
    photoPath: s.startPhotoPath,
    qtyDone: s.qtyDone,
    byKind: data.sessionItems
      .filter((i) => i.sessionId === s.id)
      .map((i) => {
        const q = data.quality.find((x) => x.sessionId === s.id && x.kind === i.kind);
        return { kind: i.kind, qty: i.qty, good: q ? q.good : null, transfer: q ? q.transfer : null, discard: q ? q.discard : null };
      }),
    qtyGood: s.qtyGood,
    qtyTransfer: s.qtyTransfer,
    qtyDiscard: s.qtyDiscard,
    notes: s.notes,
  };
}

const dayKeyBrt = (d: Date) => formatInTimeZone(d, APP_TIMEZONE, "yyyy-MM-dd");

/** O filtro de tipo vale para a DPVIM que tem aquele produto em qualquer uma das linhas. */
export type DpvimFilters = { from?: string | null; to?: string | null; kind?: DpvimKind | null; situation?: DpvimSituation | null; /** Só as que ainda esperam a nota (vale só para quem vê a nota). */ invoicePending?: boolean };

/** Todas as DPVIM do fornecedor (conferidas ou não), para abrir a lista dele no painel. */
export type DpvimSupplierDpvim = {
  id: string;
  code: string;
  status: DpvimStatus;
  arrivedAt: Date;
  finishedAt: Date | null;
  lines: { kind: string; counted: number; invoiced: number | null; balance: number | null }[];
};

export type DpvimSupplierDivergence = {
  origin: string;
  count: number;
  withDivergence: number;
  invoiced: number;
  counted: number;
  balance: number;
  missing: number;
  surplus: number;
  /** Saldo por produto, somando todas as DPVIM do fornecedor (negativo = faltam, positivo = sobram). */
  byKind: { kind: string; balance: number }[];
  dpvims: DpvimSupplierDpvim[];
};

export type DpvimDivergenceLine = { kind: string; invoiced: number; counted: number; balance: number };

export type DpvimDivergenceSummary = {
  /** DPVIM concluídas que já têm a nota (de algum produto) informada: as que entram na conferência. */
  checked: number;
  /** Quantas fecharam com diferença em algum produto. */
  withDivergence: number;
  /** Saldo final: por produto, o que sobrou numa DPVIM abate o que faltou na outra. Falta/sobra = o que resta de cada produto, somado (produtos diferentes não se compensam). */
  missing: number;
  surplus: number;
  /** Soma das notas conferidas, e quanto a falta representa disso (%). */
  invoiced: number;
  missingRate: number | null;
  bySupplier: DpvimSupplierDivergence[];
  byKind: { kind: string; invoiced: number; counted: number; balance: number; missing: number; surplus: number }[];
  /** DPVIM (não canceladas) em que falta a nota de algum produto; as concluídas primeiro, porque são as que travam a conferência. */
  awaitingInvoice: { id: string; code: string; origin: string; status: DpvimStatus; lines: { kind: string; invoice: number | null }[] }[];
  items: { id: string; code: string; origin: string; finishedAt: Date | null; balance: number; lines: DpvimDivergenceLine[] }[];
};

export type DpvimDashboard = {
  ready: boolean;
  canManage: boolean;
  /** Pode cadastrar/editar/cancelar (gestão, líderes ou liberado pelo administrador). */
  canLaunch: boolean;
  /** Vê a quantidade da nota e as divergências. */
  canSeeInvoice: boolean;
  canSeeDashboard: boolean;
  /** A sessão que o usuário logado deixou aberta (para parar), com os produtos da DPVIM. */
  mySession: { id: string; dpvimId: string; dpvimCode: string; startedAt: Date; partnerName: string | null; lines: { kind: string; expected: number }[] } | null;
  hasCollaborator: boolean;
  myCollaboratorId: string | null;
  kpis: {
    open: number;
    inProgress: number;
    late: number;
    soon: number;
    doneOnTime: number;
    doneLate: number;
    onTimeRate: number | null;
    avgLeadHours: number | null;
    totalExpected: number;
    totalDone: number;
  };
  rows: DpvimRow[];
  arrivalsByDay: { dayKey: string; arrived: number; concluded: number }[];
  byOrigin: { origin: string; count: number }[];
  divergence: DpvimDivergenceSummary;
  kinds: DpvimKindOption[];
  kindsReady: boolean;
  /** Fornecedores cadastrados; `suppliersReady` falso = a tabela ainda não existe (De onde veio fica como texto livre). */
  suppliers: DpvimSupplierOption[];
  suppliersReady: boolean;
  /** Fornecedores digitados em DPVIM e ainda não cadastrados (só para a gestão), para cadastrar de uma vez. */
  unregisteredOrigins: { origin: string; count: number }[];
  byPair: { label: string; qty: number; sessions: number }[];
  recent: DpvimSessionRow[];
  collaborators: { id: string; name: string }[];
};

/** Painel e fila de DPVIM. O período filtra pela chegada; as ainda não concluídas aparecem sempre (uma atrasada não some só porque é antiga). */
export async function getDpvimDashboard(user: CurrentUser, filters: DpvimFilters = {}): Promise<DpvimDashboard> {
  const me = await requireDpvimAccess(user);
  const manage = canManageDpvim(user);
  const launch = await canLaunchDpvim(user);
  const showInvoice = await canSeeDpvimInvoice(user);
  const seeDash = canViewDpvimDashboard(user) || launch || showInvoice;
  const now = new Date();
  const base: DpvimDashboard = {
    ready: true,
    canManage: manage,
    canLaunch: launch,
    canSeeInvoice: showInvoice,
    canSeeDashboard: seeDash,
    mySession: null,
    hasCollaborator: !!(me ?? (await myCollaborator(user))),
    myCollaboratorId: (me ?? (await myCollaborator(user)))?.id ?? null,
    kpis: { open: 0, inProgress: 0, late: 0, soon: 0, doneOnTime: 0, doneLate: 0, onTimeRate: null, avgLeadHours: null, totalExpected: 0, totalDone: 0 },
    rows: [],
    arrivalsByDay: [],
    byOrigin: [],
    divergence: { checked: 0, withDivergence: 0, missing: 0, surplus: 0, invoiced: 0, missingRate: null, bySupplier: [], byKind: [], awaitingInvoice: [], items: [] },
    kinds: [],
    kindsReady: true,
    suppliers: [],
    suppliersReady: true,
    unregisteredOrigins: [],
    byPair: [],
    recent: [],
    collaborators: [],
  };

  let all: DpvimDb[];
  let sessions: SessionDb[];
  try {
    all = await db.dpvim.findMany({ orderBy: { arrivedAt: "desc" }, take: 1000 });
    sessions = await db.dpvimSession.findMany({ where: { dpvimId: { in: all.map((d) => d.id) } }, orderBy: { startedAt: "desc" } });
  } catch (error) {
    console.error("[dpvim] tabelas indisponíveis:", error);
    return { ...base, ready: false };
  }

  const itemData = await loadItemData(all.map((d) => d.id), showInvoice);
  const kindList = await listDpvimKinds();
  const supplierList = await listDpvimSuppliers();
  const registeredKeys = new Set(supplierList.suppliers.map((s) => originGroupKey(s.label)));
  const unregistered = new Map<string, { origin: string; count: number }>();
  if (manage && supplierList.ready) {
    for (const d of all) {
      const k = originGroupKey(d.origin);
      if (registeredKeys.has(k)) continue;
      const e = unregistered.get(k) ?? { origin: d.origin, count: 0 };
      e.count += 1;
      unregistered.set(k, e);
    }
  }
  const kindFilter = filters.kind && kindList.kinds.some((k) => k.key === filters.kind) ? filters.kind : null;
  const fromAt = filters.from ? new Date(`${filters.from}T00:00:00-03:00`) : null;
  const toAt = filters.to ? new Date(new Date(`${filters.to}T00:00:00-03:00`).getTime() + 24 * 60 * 60 * 1000) : null;
  const rowsAll = all.map((d) => toRow(d, sessions, now, itemData));
  const rows = rowsAll
    .filter((r) => {
      const finished = r.status === "CONCLUIDA" || r.status === "CANCELADA";
      if (!finished) return true;
      if (fromAt && r.arrivedAt < fromAt) return false;
      if (toAt && r.arrivedAt >= toAt) return false;
      return true;
    })
    .filter((r) => (kindFilter ? r.lines.some((l) => l.kind === kindFilter) : true))
    .filter((r) => (filters.situation ? r.situation === filters.situation : true))
    .filter((r) => (filters.invoicePending && showInvoice ? r.status !== "CANCELADA" && r.lines.some((l) => l.invoice === null) : true))
    // Pendentes primeiro, pela que vence antes (as atrasadas no topo); depois as concluídas, da mais recente.
    .sort((a, b) => {
      const aOpen = a.status === "ABERTA" || a.status === "EM_ANDAMENTO";
      const bOpen = b.status === "ABERTA" || b.status === "EM_ANDAMENTO";
      if (aOpen !== bOpen) return aOpen ? -1 : 1;
      return aOpen ? a.dueAt.getTime() - b.dueAt.getTime() : b.arrivedAt.getTime() - a.arrivedAt.getTime();
    });

  const active = rows.filter((r) => r.status !== "CANCELADA");
  const doneRows = active.filter((r) => r.status === "CONCLUIDA");
  const doneOnTime = doneRows.filter((r) => r.situation === "CONCLUIDA_NO_PRAZO").length;
  const leadHours = doneRows.filter((r) => r.finishedAt).map((r) => (r.finishedAt!.getTime() - r.arrivedAt.getTime()) / 3600000);

  const arrivals = new Map<string, { arrived: number; concluded: number }>();
  for (const r of active) {
    const k = dayKeyBrt(r.arrivedAt);
    const e = arrivals.get(k) ?? { arrived: 0, concluded: 0 };
    e.arrived += 1;
    arrivals.set(k, e);
    if (r.status === "CONCLUIDA" && r.finishedAt) {
      const fk = dayKeyBrt(r.finishedAt);
      const fe = arrivals.get(fk) ?? { arrived: 0, concluded: 0 };
      fe.concluded += 1;
      arrivals.set(fk, fe);
    }
  }

  const origins = new Map<string, number>();
  for (const r of active) origins.set(r.origin, (origins.get(r.origin) ?? 0) + 1);

  // Conferência: o que os ajudantes contaram de cada produto contra a nota, nas DPVIM concluídas que já têm a nota informada.
  // Agrupa o fornecedor sem diferenciar maiúsculas/acento, mostrando o nome como foi digitado primeiro.
  const conferred = active.filter((r) => r.lines.some((l) => l.balance !== null));
  const suppliers = new Map<string, DpvimSupplierDivergence>();
  const kinds = new Map<string, { kind: string; invoiced: number; counted: number; balance: number; missing: number; surplus: number }>();
  const supplierKinds = new Map<string, Map<string, number>>();
  let missingTotal = 0;
  let surplusTotal = 0;
  let invoicedTotal = 0;
  for (const r of conferred) {
    const key = originGroupKey(r.origin);
    const e = suppliers.get(key) ?? { origin: r.origin, count: 0, withDivergence: 0, invoiced: 0, counted: 0, balance: 0, missing: 0, surplus: 0, byKind: [], dpvims: [] };
    e.count += 1;
    if (r.lines.some((l) => l.balance !== null && l.balance !== 0)) e.withDivergence += 1;
    const perKind = supplierKinds.get(key) ?? new Map<string, number>();
    for (const l of r.lines) {
      if (l.balance === null || l.invoice === null) continue;
      e.invoiced += l.invoice;
      e.counted += l.done;
      e.balance += l.balance;
      perKind.set(l.kind, (perKind.get(l.kind) ?? 0) + l.balance);
      const k = kinds.get(l.kind) ?? { kind: l.kind, invoiced: 0, counted: 0, balance: 0, missing: 0, surplus: 0 };
      k.invoiced += l.invoice;
      k.counted += l.done;
      k.balance += l.balance;
      invoicedTotal += l.invoice;
      kinds.set(l.kind, k);
    }
    supplierKinds.set(key, perKind);
    suppliers.set(key, e);
  }
  // Saldo final: soma por produto (o que sobrou numa DPVIM abate o que faltou na outra) e só depois separa em "faltam" e "sobram".
  for (const [key, e] of suppliers) {
    e.byKind = [...(supplierKinds.get(key) ?? new Map<string, number>()).entries()].map(([kind, balance]) => ({ kind, balance }));
    e.missing = e.byKind.reduce((sum, b) => sum + Math.max(0, -b.balance), 0);
    e.surplus = e.byKind.reduce((sum, b) => sum + Math.max(0, b.balance), 0);
  }
  for (const k of kinds.values()) {
    k.missing = Math.max(0, -k.balance);
    k.surplus = Math.max(0, k.balance);
    missingTotal += k.missing;
    surplusTotal += k.surplus;
  }
  // A lista de cada fornecedor traz todas as DPVIM dele (inclusive as que ainda esperam a nota), da mais recente para a mais antiga.
  for (const r of active) {
    const e = suppliers.get(originGroupKey(r.origin));
    if (!e) continue;
    e.dpvims.push({
      id: r.id,
      code: r.code,
      status: r.status,
      arrivedAt: r.arrivedAt,
      finishedAt: r.finishedAt,
      lines: r.lines.map((l) => ({ kind: l.kind, counted: l.done, invoiced: l.invoice, balance: l.balance })),
    });
  }
  for (const e of suppliers.values()) e.dpvims.sort((a, b) => b.arrivedAt.getTime() - a.arrivedAt.getTime());
  const divergentRows = conferred.filter((r) => r.lines.some((l) => l.balance !== null && l.balance !== 0));
  const divergence: DpvimDivergenceSummary = {
    checked: conferred.length,
    withDivergence: divergentRows.length,
    missing: missingTotal,
    surplus: surplusTotal,
    invoiced: invoicedTotal,
    missingRate: invoicedTotal > 0 ? Math.round((missingTotal / invoicedTotal) * 1000) / 10 : null,
    awaitingInvoice: showInvoice
      ? active
          .filter((r) => r.lines.some((l) => l.invoice === null))
          .map((r) => ({ id: r.id, code: r.code, origin: r.origin, status: r.status, lines: r.lines.map((l) => ({ kind: l.kind, invoice: l.invoice })) }))
          .sort((a, b) => Number(b.status === "CONCLUIDA") - Number(a.status === "CONCLUIDA"))
      : [],
    bySupplier: [...suppliers.values()].sort((a, b) => b.missing - a.missing || a.balance - b.balance || b.count - a.count),
    byKind: [...kinds.values()].sort((a, b) => b.missing - a.missing || b.surplus - a.surplus),
    items: divergentRows
      .map((r) => ({
        id: r.id,
        code: r.code,
        origin: r.origin,
        finishedAt: r.finishedAt,
        balance: r.balance ?? 0,
        lines: r.lines.filter((l) => l.balance !== null && l.invoice !== null).map((l) => ({ kind: l.kind, invoiced: l.invoice ?? 0, counted: l.done, balance: l.balance ?? 0 })),
      }))
      .sort((a, b) => a.balance - b.balance),
  };

  const ids = new Set(rows.map((r) => r.id));
  const codeById = new Map(all.map((d) => [d.id, d.code]));
  const periodSessions = sessions.filter((s) => ids.has(s.dpvimId));
  const pairs = new Map<string, { qty: number; sessions: number }>();
  for (const s of periodSessions) {
    if (s.qtyDone === null) continue;
    const label = s.partnerName ? [s.workerName, s.partnerName].sort((a, b) => a.localeCompare(b, "pt-BR")).join(" + ") : s.workerName;
    const e = pairs.get(label) ?? { qty: 0, sessions: 0 };
    e.qty += s.qtyDone;
    e.sessions += 1;
    pairs.set(label, e);
  }

  const mine = sessions.find((s) => s.userId === user.id && !s.stoppedAt) ?? null;
  const mineRow = mine ? rowsAll.find((r) => r.id === mine.dpvimId) : null;
  // Nomes dos colegas ativos: servem para escolher a dupla ao abrir a DPVIM.
  const collaborators = await db.collaborator.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });

  return {
    ...base,
    mySession: mine
      ? {
          id: mine.id,
          dpvimId: mine.dpvimId,
          dpvimCode: codeById.get(mine.dpvimId) ?? "?",
          startedAt: mine.startedAt,
          partnerName: mine.partnerName,
          lines: (mineRow?.lines ?? []).map((l) => ({ kind: l.kind, expected: l.expected })),
        }
      : null,
    kpis: {
      open: active.filter((r) => r.status === "ABERTA").length,
      inProgress: active.filter((r) => r.status === "EM_ANDAMENTO").length,
      late: active.filter((r) => r.situation === "ATRASADA").length,
      soon: active.filter((r) => r.situation === "VENCE_LOGO").length,
      doneOnTime,
      doneLate: doneRows.length - doneOnTime,
      onTimeRate: doneRows.length > 0 ? Math.round((doneOnTime / doneRows.length) * 100) : null,
      avgLeadHours: leadHours.length > 0 ? leadHours.reduce((s, h) => s + h, 0) / leadHours.length : null,
      totalExpected: active.reduce((s, r) => s + r.expectedQty, 0),
      totalDone: active.reduce((s, r) => s + r.doneQty, 0),
    },
    // Quem só executa (ajudante/colaborador, sem acesso ao painel) não vê de qual fornecedor veio a carga: o nome nem sai do servidor.
    rows: seeDash ? rows : rows.map((r) => ({ ...r, origin: "" })),
    arrivalsByDay: [...arrivals.entries()].map(([dayKey, v]) => ({ dayKey, ...v })).sort((a, b) => a.dayKey.localeCompare(b.dayKey)),
    divergence,
    kinds: kindList.kinds,
    kindsReady: kindList.ready,
    suppliers: supplierList.suppliers,
    suppliersReady: supplierList.ready,
    unregisteredOrigins: [...unregistered.values()].sort((a, b) => b.count - a.count),
    byOrigin: seeDash ? [...origins.entries()].map(([origin, count]) => ({ origin, count })).sort((a, b) => b.count - a.count) : [],
    byPair: [...pairs.entries()].map(([label, v]) => ({ label, ...v })).sort((a, b) => b.qty - a.qty),
    recent: periodSessions.slice(0, 15).map((s) => toSessionRow(s, codeById.get(s.dpvimId) ?? "?", itemData)),
    collaborators,
  };
}

export type DpvimDetail = {
  row: DpvimRow;
  sessions: DpvimSessionRow[];
  canManage: boolean;
  canLaunch: boolean;
  canSeeInvoice: boolean;
  mySession: { id: string; startedAt: Date } | null;
  hasCollaborator: boolean;
  collaborators: { id: string; name: string }[];
  myCollaboratorId: string | null;
  kinds: DpvimKindOption[];
  suppliers: DpvimSupplierOption[];
  suppliersReady: boolean;
};

export async function getDpvimDetail(user: CurrentUser, id: string): Promise<DpvimDetail | null> {
  const me = await requireDpvimAccess(user);
  const d = await db.dpvim.findUnique({ where: { id } });
  if (!d) return null;
  const sessions = await db.dpvimSession.findMany({ where: { dpvimId: id }, orderBy: { startedAt: "desc" } });
  const showInvoice = await canSeeDpvimInvoice(user);
  const itemData = await loadItemData([id], showInvoice);
  const collab = me ?? (await myCollaborator(user));
  const openMine = await db.dpvimSession.findFirst({ where: { userId: user.id, stoppedAt: null } });
  const launch = await canLaunchDpvim(user);
  // Quem só executa não vê o fornecedor da carga.
  const seeSupplier = canViewDpvimDashboard(user) || launch || showInvoice;
  const row = toRow(d, sessions, new Date(), itemData);
  return {
    row: seeSupplier ? row : { ...row, origin: "" },
    sessions: sessions.map((s) => toSessionRow(s, d.code, itemData)),
    canManage: canManageDpvim(user),
    canLaunch: launch,
    canSeeInvoice: showInvoice,
    mySession: openMine && openMine.dpvimId === id ? { id: openMine.id, startedAt: openMine.startedAt } : null,
    hasCollaborator: !!collab,
    collaborators: await db.collaborator.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    myCollaboratorId: collab?.id ?? null,
    kinds: (await listDpvimKinds()).kinds,
    suppliers: (await listDpvimSuppliers()).suppliers,
    suppliersReady: (await listDpvimSuppliers()).ready,
  };
}

/** `items` = o que veio, produto a produto, pela contagem do conferente (só um norte). A quantidade da NOTA é lançada à parte, por quem tem acesso a ela. */
export type DpvimInput = { origin: string; reference: string; material: string; items: { kind: string; qty: number }[]; arrivedAtIso: string; notes: string };

async function validate(input: DpvimInput, currentKinds: string[] = [], currentOrigin?: string) {
  const { kinds } = await listDpvimKinds();
  if (input.items.length === 0) throw new Error("Informe pelo menos um produto (tipo e quantidade).");
  if (input.items.length > 12) throw new Error("Informe no máximo 12 produtos por DPVIM.");
  const seen = new Set<string>();
  for (const it of input.items) {
    const kind = kinds.find((k) => k.key === it.kind);
    // Tipo desativado só vale para a DPVIM que já tinha esse produto; para cadastrar nova, tem que estar ativo.
    if (!kind || (!kind.active && !currentKinds.includes(it.kind))) throw new Error("Escolha o tipo de cada produto.");
    if (seen.has(it.kind)) throw new Error("Escolha cada tipo uma vez só (some as quantidades do mesmo tipo).");
    seen.add(it.kind);
    if (!Number.isInteger(it.qty) || it.qty <= 0 || it.qty > 100000) throw new Error("Informe a quantidade de cada produto com um número inteiro.");
  }
  // Com a lista de fornecedores no ar, "De onde veio" tem que ser um fornecedor ativo (ou o que a DPVIM já tinha). Sem a lista, vale o texto livre de antes.
  const { suppliers, ready } = await listDpvimSuppliers();
  let origin = input.origin.trim();
  if (ready) {
    const key = originGroupKey(origin);
    const match = suppliers.find((s) => s.active && originGroupKey(s.label) === key);
    if (match) origin = match.label;
    else if (!(currentOrigin !== undefined && originGroupKey(currentOrigin) === key)) throw new Error("Escolha o fornecedor da lista (ou cadastre um novo).");
  } else if (origin.length < 2) {
    throw new Error("Informe de onde a DPVIM veio.");
  }
  const arrivedAt = new Date(input.arrivedAtIso);
  if (Number.isNaN(arrivedAt.getTime())) throw new Error("Informe quando a DPVIM chegou.");
  if (arrivedAt.getTime() > Date.now() + 60 * 60 * 1000) throw new Error("A chegada não pode ser no futuro.");
  return { arrivedAt, origin: origin.slice(0, 120) };
}

export async function createDpvim(user: CurrentUser, input: DpvimInput) {
  if (!(await canLaunchDpvim(user))) throw new ForbiddenError();
  const { arrivedAt, origin } = await validate(input);
  const code = await nextFriendlyCode("dpvim", "DPVIM", 4);
  const created = await db.$transaction(async (tx) => {
    const dpvim = await tx.dpvim.create({
      data: {
        code,
        kind: input.items[0].kind,
        origin,
        reference: input.reference.trim() ? input.reference.trim().slice(0, 80) : null,
        material: input.material.trim() ? input.material.trim().slice(0, 300) : null,
        expectedQty: input.items.reduce((s, i) => s + i.qty, 0),
        arrivedAt,
        dueAt: dueAtFrom(arrivedAt),
        notes: input.notes.trim() ? input.notes.trim().slice(0, 1000) : null,
        createdById: user.id,
        createdByName: user.name,
      },
    });
    await tx.dpvimItem.createMany({ data: input.items.map((i, sort) => ({ dpvimId: dpvim.id, kind: i.kind, expectedQty: i.qty, sort })) });
    return dpvim;
  });
  await recordAudit({ userId: user.id, action: "CREATE", entityType: "Dpvim", entityId: created.id, newValue: { code, ...input } });
  return created;
}

export async function updateDpvim(user: CurrentUser, id: string, input: DpvimInput) {
  if (!(await canLaunchDpvim(user))) throw new ForbiddenError();
  const before = await db.dpvim.findUniqueOrThrow({ where: { id } });
  const currentItems = await db.dpvimItem.findMany({ where: { dpvimId: id } }).catch(() => []);
  const { arrivedAt, origin } = await validate(input, currentItems.length > 0 ? currentItems.map((i) => i.kind) : [before.kind], before.origin);
  const updated = await db.$transaction(async (tx) => {
    const dpvim = await tx.dpvim.update({
      where: { id },
      data: {
        kind: input.items[0].kind,
        origin,
        reference: input.reference.trim() ? input.reference.trim().slice(0, 80) : null,
        material: input.material.trim() ? input.material.trim().slice(0, 300) : null,
        expectedQty: input.items.reduce((s, i) => s + i.qty, 0),
        arrivedAt,
        dueAt: dueAtFrom(arrivedAt),
        notes: input.notes.trim() ? input.notes.trim().slice(0, 1000) : null,
      },
    });
    await tx.dpvimItem.deleteMany({ where: { dpvimId: id } });
    await tx.dpvimItem.createMany({ data: input.items.map((i, sort) => ({ dpvimId: id, kind: i.kind, expectedQty: i.qty, sort })) });
    return dpvim;
  });
  await recordAudit({ userId: user.id, action: "UPDATE", entityType: "Dpvim", entityId: id, previousValue: before, newValue: input });
  return updated;
}

/** Quem tem acesso à nota informa (ou corrige) a quantidade dela, produto a produto (vazio = ainda não informada). Com isso a contagem dos ajudantes é conferida. */
export async function setDpvimInvoiceQty(user: CurrentUser, id: string, items: { kind: string; qty: number | null }[]) {
  if (!(await canSeeDpvimInvoice(user))) throw new ForbiddenError();
  const d = await db.dpvim.findUniqueOrThrow({ where: { id } });
  const { kinds } = await listDpvimKinds();
  const seen = new Set<string>();
  for (const it of items) {
    if (!kinds.some((k) => k.key === it.kind) || seen.has(it.kind)) throw new Error("Escolha cada tipo uma vez só.");
    seen.add(it.kind);
    if (it.qty !== null && (!Number.isInteger(it.qty) || it.qty <= 0 || it.qty > 100000)) throw new Error("Informe a quantidade da nota com um número inteiro.");
  }
  const before = await db.dpvimItemInvoice.findMany({ where: { dpvimId: id } });
  await db.$transaction(async (tx) => {
    for (const it of items) {
      if (it.qty === null) {
        await tx.dpvimItemInvoice.deleteMany({ where: { dpvimId: id, kind: it.kind } });
      } else {
        await tx.dpvimItemInvoice.upsert({
          where: { dpvimId_kind: { dpvimId: id, kind: it.kind } },
          create: { dpvimId: id, kind: it.kind, qty: it.qty, updatedById: user.id, updatedByName: user.name },
          update: { qty: it.qty, updatedById: user.id, updatedByName: user.name, updatedAt: new Date() },
        });
      }
    }
  });
  await recordAudit({
    userId: user.id,
    action: "UPDATE",
    entityType: "DpvimItemInvoice",
    entityId: id,
    previousValue: before.map((b) => ({ kind: b.kind, qty: b.qty })),
    newValue: { code: d.code, items },
  });
}

export async function setDpvimCancelled(user: CurrentUser, id: string, cancelled: boolean) {
  if (!(await canLaunchDpvim(user))) throw new ForbiddenError();
  const d = await db.dpvim.findUniqueOrThrow({ where: { id } });
  if (cancelled) {
    const open = await db.dpvimSession.count({ where: { dpvimId: id, stoppedAt: null } });
    if (open > 0) throw new Error("Tem gente com essa DPVIM aberta. Peça para parar antes de cancelar.");
    await db.dpvim.update({ where: { id }, data: { status: "CANCELADA" } });
  } else {
    await db.dpvim.update({ where: { id }, data: { status: d.doneQty > 0 ? "EM_ANDAMENTO" : "ABERTA", finishedAt: null } });
  }
  await recordAudit({ userId: user.id, action: "STATUS_CHANGE", entityType: "Dpvim", entityId: id, previousValue: { status: d.status }, newValue: { cancelled } });
}

/** O ajudante abre a DPVIM: foto de confirmação obrigatória, e fica registrado quem e quando. Uma pessoa só pode ter uma DPVIM aberta por vez. */
export async function startDpvimSession(
  user: CurrentUser,
  dpvimId: string,
  photo: { filename: string; path: string },
  partnerId: string | null,
) {
  const me = await myCollaborator(user);
  if (!me) throw new ForbiddenError("Seu usuário não está ligado a um colaborador, então não dá para abrir a DPVIM.");
  const d = await db.dpvim.findUniqueOrThrow({ where: { id: dpvimId } });
  if (d.status === "CONCLUIDA" || d.status === "CANCELADA") throw new Error("Essa DPVIM já foi encerrada.");
  const already = await db.dpvimSession.findFirst({ where: { userId: user.id, stoppedAt: null } });
  if (already) throw new Error("Você já está com uma DPVIM aberta. Pare a atividade antes de abrir outra.");
  let partnerName: string | null = null;
  if (partnerId) {
    const partner = await db.collaborator.findUnique({ where: { id: partnerId }, select: { id: true, name: true } });
    if (!partner || partner.id === me.id) throw new Error("Escolha a dupla de outra pessoa.");
    partnerName = partner.name;
  }
  const session = await db.dpvimSession.create({
    data: {
      dpvimId,
      userId: user.id,
      collaboratorId: me.id,
      workerName: me.name,
      partnerId: partnerId || null,
      partnerName,
      startPhotoPath: photo.path,
      startPhotoName: photo.filename,
    },
  });
  if (d.status === "ABERTA") await db.dpvim.update({ where: { id: dpvimId }, data: { status: "EM_ANDAMENTO" } });
  await recordAudit({ userId: user.id, action: "CREATE", entityType: "DpvimSession", entityId: session.id, newValue: { dpvimId, code: d.code, worker: me.name, partner: partnerName } });
  return session;
}

/** `items` = quanto contaram de cada produto da DPVIM nesta atividade e, se quiserem, quantos desses foram bons, transferência e descarte (por produto). */
export type StopInput = {
  items: { kind: string; qty: number; good: number | null; transfer: number | null; discard: number | null }[];
  notes: string;
  finish: boolean;
};

function optionalInt(v: number | null, label: string): number | null {
  if (v === null) return null;
  if (!Number.isInteger(v) || v < 0 || v > 100000) throw new Error(`${label}: informe um número inteiro.`);
  return v;
}

/**
 * O ajudante para a atividade: informa quanto contou de cada produto. A DPVIM só conclui quando ele marca que terminou:
 * o "norte" do conferente não é limite (dá para contar mais ou menos do que ele), e a conta que vale é a dos ajudantes contra a nota.
 */
export async function stopDpvimSession(user: CurrentUser, sessionId: string, input: StopInput) {
  const session = await db.dpvimSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (session.userId !== user.id && !canManageDpvim(user)) throw new ForbiddenError();
  if (session.stoppedAt) throw new Error("Essa atividade já foi parada.");
  const d = await db.dpvim.findUniqueOrThrow({ where: { id: session.dpvimId } });
  const dpvimItems = await db.dpvimItem.findMany({ where: { dpvimId: d.id } }).catch(() => []);
  const allowed = dpvimItems.length > 0 ? dpvimItems.map((i) => i.kind) : [d.kind];
  const kindOptions = (await listDpvimKinds()).kinds;
  const seen = new Set<string>();
  for (const it of input.items) {
    if (!allowed.includes(it.kind) || seen.has(it.kind)) throw new Error("Escolha só os produtos desta DPVIM, uma vez cada.");
    seen.add(it.kind);
    if (!Number.isInteger(it.qty) || it.qty < 0 || it.qty > 100000) throw new Error("Informe quantos itens foram feitos de cada produto.");
    const label = dpvimKindLabel(it.kind, kindOptions);
    const good = optionalInt(it.good, `Bons de ${label}`);
    const transfer = optionalInt(it.transfer, `Transferência de ${label}`);
    const discard = optionalInt(it.discard, `Descarte de ${label}`);
    if ((good ?? 0) + (transfer ?? 0) + (discard ?? 0) > it.qty) throw new Error(`Informe de novo: em ${label}, bons + transferência + descarte passam do que foi contado.`);
  }
  const qtyDone = input.items.reduce((s, i) => s + i.qty, 0);
  // No total da atividade (e nas atividades antigas) ficam as somas de cada produto; sem nenhum valor informado, fica vazio.
  const sumOf = (pick: (i: StopInput["items"][number]) => number | null) => (input.items.some((i) => pick(i) !== null) ? input.items.reduce((s, i) => s + (pick(i) ?? 0), 0) : null);
  const qtyGood = sumOf((i) => i.good);
  const qtyTransfer = sumOf((i) => i.transfer);
  const qtyDiscard = sumOf((i) => i.discard);

  const now = new Date();
  const doneQty = d.doneQty + qtyDone;
  await db.$transaction(async (tx) => {
    await tx.dpvimSession.update({
      where: { id: sessionId },
      data: { stoppedAt: now, qtyDone, qtyGood, qtyTransfer, qtyDiscard, notes: input.notes.trim() ? input.notes.trim().slice(0, 500) : null },
    });
    const positive = input.items.filter((i) => i.qty > 0);
    if (positive.length > 0) await tx.dpvimSessionItem.createMany({ data: positive.map((i) => ({ sessionId, dpvimId: d.id, kind: i.kind, qty: i.qty })) });
    const withQuality = input.items.filter((i) => i.good !== null || i.transfer !== null || i.discard !== null);
    if (withQuality.length > 0) {
      await tx.dpvimSessionQuality.createMany({ data: withQuality.map((i) => ({ sessionId, dpvimId: d.id, kind: i.kind, good: i.good ?? 0, transfer: i.transfer ?? 0, discard: i.discard ?? 0 })) });
    }
    await tx.dpvim.update({ where: { id: d.id }, data: { doneQty, ...(input.finish ? { status: "CONCLUIDA", finishedAt: now } : {}) } });
  });
  await recordAudit({ userId: user.id, action: "UPDATE", entityType: "DpvimSession", entityId: sessionId, newValue: { ...input, qtyDone, code: d.code, concluded: input.finish } });
  return { concluded: input.finish };
}

/** Exclui a DPVIM de vez, com as atividades, os produtos, as notas e as fotos (para tirar um cadastro de teste ou errado do histórico). Não dá para desfazer. */
export async function deleteDpvim(user: CurrentUser, id: string) {
  if (!canManageDpvim(user)) throw new ForbiddenError();
  const before = await db.dpvim.findUnique({ where: { id } });
  if (!before) return;
  const sessions = await db.dpvimSession.findMany({ where: { dpvimId: id } });
  if (sessions.some((s) => !s.stoppedAt)) throw new Error("Tem gente com essa DPVIM aberta. Peça para parar antes de excluir.");
  await db.dpvimSession.deleteMany({ where: { dpvimId: id } });
  await db.dpvim.delete({ where: { id } });
  await db.dpvimSessionItem.deleteMany({ where: { dpvimId: id } }).catch(() => undefined);
  await db.dpvimItem.deleteMany({ where: { dpvimId: id } }).catch(() => undefined);
  await db.dpvimItemInvoice.deleteMany({ where: { dpvimId: id } }).catch(() => undefined);
  await db.dpvimSessionQuality.deleteMany({ where: { dpvimId: id } }).catch(() => undefined);
  for (const s of sessions) await deleteStoredFile(s.startPhotoPath);
  await recordAudit({ userId: user.id, action: "CANCEL", entityType: "Dpvim", entityId: id, previousValue: { code: before.code, kind: before.kind, origin: before.origin, expectedQty: before.expectedQty, doneQty: before.doneQty, sessions: sessions.length } });
}

export type DpvimTimelineEvent = { at: Date; text: string; by: string | null; href: string | null; tone: "neutral" | "success" | "danger" | "warning" | "accent" };

export type DpvimSupplierDetail = {
  supplier: DpvimSupplierOption & { createdAt: Date; createdBy: string | null };
  stats: { total: number; open: number; late: number; concluded: number; onTimeRate: number | null; avgLeadHours: number | null };
  canSeeInvoice: boolean;
  /** Saldo por produto somando todas as DPVIM do fornecedor (só para quem vê a nota). Negativo = faltam, positivo = sobram. */
  balance: { kind: string; balance: number }[] | null;
  /** DPVIM ainda sem a nota de algum produto (só para quem vê a nota). */
  awaitingInvoice: number;
  rows: (DpvimRow & { createdByName: string })[];
  timeline: DpvimTimelineEvent[];
  kinds: DpvimKindOption[];
};

function parseJson(v: string | null): Record<string, unknown> | null {
  if (!v) return null;
  try {
    const parsed = JSON.parse(v);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** A ficha de um fornecedor: cadastro, números, todas as DPVIM dele e a linha do tempo (quem cadastrou, editou, uniu, abriu, finalizou e lançou a nota). Só gestão. */
export async function getDpvimSupplierDetail(user: CurrentUser, id: string): Promise<DpvimSupplierDetail | null> {
  if (!canManageDpvim(user)) throw new ForbiddenError();
  const sup = await db.dpvimSupplier.findUnique({ where: { id } });
  if (!sup) return null;
  const label = supplierLabel(sup.name, sup.unit);
  const key = originGroupKey(label);
  const showInvoice = await canSeeDpvimInvoice(user);
  const { kinds } = await listDpvimKinds();
  const kindName = (k: string) => dpvimKindLabel(k, kinds);

  const all = await db.dpvim.findMany({ orderBy: { arrivedAt: "desc" } });
  const mine = all.filter((d) => originGroupKey(d.origin) === key);
  const ids = mine.map((d) => d.id);
  const sessions = ids.length > 0 ? await db.dpvimSession.findMany({ where: { dpvimId: { in: ids } }, orderBy: { startedAt: "desc" } }) : [];
  const itemData = await loadItemData(ids, showInvoice);
  const now = new Date();
  const rows = mine.map((d) => ({ ...toRow(d, sessions, now, itemData), createdByName: d.createdByName }));

  const active = rows.filter((r) => r.status !== "CANCELADA");
  const doneRows = active.filter((r) => r.status === "CONCLUIDA");
  const onTime = doneRows.filter((r) => r.situation === "CONCLUIDA_NO_PRAZO").length;
  const leads = doneRows.filter((r) => r.finishedAt).map((r) => (r.finishedAt!.getTime() - r.arrivedAt.getTime()) / 3600000);

  let balance: DpvimSupplierDetail["balance"] = null;
  if (showInvoice) {
    const per = new Map<string, number>();
    for (const r of active) for (const l of r.lines) if (l.balance !== null) per.set(l.kind, (per.get(l.kind) ?? 0) + l.balance);
    balance = [...per.entries()].map(([kind, b]) => ({ kind, balance: b }));
  }

  // Linha do tempo: o que aconteceu com o cadastro do fornecedor (log de auditoria) e com as DPVIM dele.
  const audits = await db.auditLog
    .findMany({
      where: { entityType: "DpvimSupplier", OR: [{ entityId: id }, { newValue: { contains: `"mergedInto":"${id}"` } }] },
      orderBy: { occurredAt: "desc" },
      include: { user: { select: { name: true } } },
      take: 100,
    })
    .catch(() => []);
  const timeline: DpvimTimelineEvent[] = [];
  let createdBy: string | null = null;
  for (const a of audits) {
    const prev = parseJson(a.previousValue);
    const next = parseJson(a.newValue);
    const by = a.user?.name ?? null;
    if (a.action === "CREATE" && a.entityId === id) {
      createdBy = by;
      timeline.push({ at: a.occurredAt, text: "Fornecedor cadastrado", by, href: null, tone: "accent" });
    } else if (next && "mergedInto" in next) {
      const moved = typeof next.moved === "number" ? next.moved : 0;
      timeline.push({ at: a.occurredAt, text: `Unido a este fornecedor: ${prev && typeof prev.name === "string" ? supplierLabel(prev.name, typeof prev.unit === "string" ? prev.unit : null) : "outro cadastro"} (${moved} DPVIM passaram para cá)`, by, href: null, tone: "warning" });
    } else if (next && "active" in next) {
      timeline.push({ at: a.occurredAt, text: next.active ? "Fornecedor reativado" : "Fornecedor desativado", by, href: null, tone: next.active ? "success" : "neutral" });
    } else if (prev && next && typeof prev.name === "string" && typeof next.name === "string") {
      const from = supplierLabel(prev.name, typeof prev.unit === "string" ? prev.unit : null);
      const to = supplierLabel(next.name, typeof next.unit === "string" ? next.unit : null);
      timeline.push({ at: a.occurredAt, text: `Nome alterado de "${from}" para "${to}"`, by, href: null, tone: "neutral" });
    }
  }
  if (!audits.some((a) => a.action === "CREATE" && a.entityId === id)) timeline.push({ at: sup.createdAt, text: "Fornecedor cadastrado", by: null, href: null, tone: "accent" });

  for (const d of mine) {
    const r = rows.find((x) => x.id === d.id)!;
    const href = `/dpvim/${d.id}`;
    timeline.push({ at: d.createdAt, text: `${d.code} cadastrada (${r.lines.map((l) => `${kindName(l.kind)} ${l.expected}`).join(" + ")})`, by: d.createdByName, href, tone: "neutral" });
    for (const s of sessions.filter((x) => x.dpvimId === d.id)) {
      timeline.push({ at: s.startedAt, text: `${d.code} aberta${s.partnerName ? ` (dupla: ${s.partnerName})` : ""}`, by: s.workerName, href, tone: "accent" });
    }
    if (d.finishedAt && d.status === "CONCLUIDA") {
      timeline.push({ at: d.finishedAt, text: `${d.code} finalizada ${r.situation === "CONCLUIDA_ATRASADA" ? "com atraso" : "no prazo"} (${d.doneQty} contados)`, by: null, href, tone: r.situation === "CONCLUIDA_ATRASADA" ? "danger" : "success" });
    }
  }
  if (showInvoice && ids.length > 0) {
    const invoices = await db.dpvimItemInvoice.findMany({ where: { dpvimId: { in: ids } } }).catch(() => []);
    const latest = new Map<string, (typeof invoices)[number]>();
    for (const i of invoices) {
      const cur = latest.get(i.dpvimId);
      if (!cur || i.updatedAt > cur.updatedAt) latest.set(i.dpvimId, i);
    }
    for (const [dpvimId, i] of latest) {
      const d = mine.find((x) => x.id === dpvimId);
      if (d) timeline.push({ at: i.updatedAt, text: `Quantidade da nota lançada em ${d.code}`, by: i.updatedByName, href: `/dpvim/${dpvimId}`, tone: "accent" });
    }
  }
  timeline.sort((a, b) => b.at.getTime() - a.at.getTime());

  return {
    supplier: { id: sup.id, name: sup.name, unit: sup.unit, label, active: sup.active, createdAt: sup.createdAt, createdBy },
    stats: {
      total: active.length,
      open: active.filter((r) => r.status === "ABERTA" || r.status === "EM_ANDAMENTO").length,
      late: active.filter((r) => r.situation === "ATRASADA").length,
      concluded: doneRows.length,
      onTimeRate: doneRows.length > 0 ? Math.round((onTime / doneRows.length) * 100) : null,
      avgLeadHours: leads.length > 0 ? leads.reduce((sum, h) => sum + h, 0) / leads.length : null,
    },
    canSeeInvoice: showInvoice,
    balance,
    awaitingInvoice: showInvoice ? active.filter((r) => r.lines.some((l) => l.invoice === null)).length : 0,
    rows,
    timeline: timeline.slice(0, 80),
    kinds,
  };
}
