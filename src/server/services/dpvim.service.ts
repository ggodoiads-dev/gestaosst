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
import { DPVIM_KINDS, buildLines, dpvimSituation, dueAtFrom, kindKeyFromLabel, originGroupKey, progressPercent, type DpvimKind, type DpvimKindOption, type DpvimLine, type DpvimSituation, type DpvimStatus } from "@/domain/dpvim/rules";

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
  /** O que contaram de cada produto nessa atividade (vazio nas atividades antigas, de um produto só). */
  byKind: { kind: string; qty: number }[];
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
  /** `null` = quem vê não tem acesso à nota (as notas nem são lidas). */
  invoice: { dpvimId: string; kind: string; qty: number }[] | null;
};

/** Produtos, contagem por produto e notas das DPVIM. Leitura tolerante: se as tabelas novas ainda não existem, tudo vale como antes (um produto só). */
async function loadItemData(dpvimIds: string[], showInvoice: boolean): Promise<ItemData> {
  const data: ItemData = { items: [], sessionItems: [], invoice: showInvoice ? [] : null };
  try {
    data.items = await db.dpvimItem.findMany({ where: { dpvimId: { in: dpvimIds } }, orderBy: { sort: "asc" } });
    data.sessionItems = await db.dpvimSessionItem.findMany({ where: { dpvimId: { in: dpvimIds } } });
  } catch (error) {
    console.error("[dpvim] tabelas de produtos indisponíveis:", error);
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
  const invoiceByKind = data.invoice ? new Map(data.invoice.filter((i) => i.dpvimId === d.id).map((i) => [i.kind, i.qty] as const)) : null;
  const lines = buildLines({
    legacyKind: d.kind,
    legacyExpected: d.expectedQty,
    items: data.items.filter((i) => i.dpvimId === d.id),
    doneByKind,
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
    byKind: data.sessionItems.filter((i) => i.sessionId === s.id).map((i) => ({ kind: i.kind, qty: i.qty })),
    qtyGood: s.qtyGood,
    qtyTransfer: s.qtyTransfer,
    qtyDiscard: s.qtyDiscard,
    notes: s.notes,
  };
}

const dayKeyBrt = (d: Date) => formatInTimeZone(d, APP_TIMEZONE, "yyyy-MM-dd");

/** O filtro de tipo vale para a DPVIM que tem aquele produto em qualquer uma das linhas. */
export type DpvimFilters = { from?: string | null; to?: string | null; kind?: DpvimKind | null; situation?: DpvimSituation | null };

export type DpvimSupplierDivergence = { origin: string; count: number; withDivergence: number; invoiced: number; counted: number; balance: number; missing: number; surplus: number };

export type DpvimDivergenceLine = { kind: string; invoiced: number; counted: number; balance: number };

export type DpvimDivergenceSummary = {
  /** DPVIM concluídas que já têm a nota (de algum produto) informada: as que entram na conferência. */
  checked: number;
  /** Quantas fecharam com diferença em algum produto. */
  withDivergence: number;
  /** Total que faltou e total que sobrou, somando produto a produto (uma falta num produto não "compensa" uma sobra em outro). */
  missing: number;
  surplus: number;
  /** Soma das notas conferidas, e quanto a falta representa disso (%). */
  invoiced: number;
  missingRate: number | null;
  bySupplier: DpvimSupplierDivergence[];
  byKind: { kind: string; invoiced: number; counted: number; missing: number; surplus: number }[];
  /** DPVIM (não canceladas) em que falta a nota de algum produto. */
  awaitingInvoice: { id: string; code: string; origin: string; kinds: string[]; counted: number }[];
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
  const seeDash = canViewDpvimDashboard(user) || launch;
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
  const kinds = new Map<string, { kind: string; invoiced: number; counted: number; missing: number; surplus: number }>();
  let missingTotal = 0;
  let surplusTotal = 0;
  let invoicedTotal = 0;
  for (const r of conferred) {
    const key = originGroupKey(r.origin);
    const e = suppliers.get(key) ?? { origin: r.origin, count: 0, withDivergence: 0, invoiced: 0, counted: 0, balance: 0, missing: 0, surplus: 0 };
    e.count += 1;
    if (r.lines.some((l) => l.balance !== null && l.balance !== 0)) e.withDivergence += 1;
    for (const l of r.lines) {
      if (l.balance === null || l.invoice === null) continue;
      e.invoiced += l.invoice;
      e.counted += l.done;
      e.balance += l.balance;
      const k = kinds.get(l.kind) ?? { kind: l.kind, invoiced: 0, counted: 0, missing: 0, surplus: 0 };
      k.invoiced += l.invoice;
      k.counted += l.done;
      invoicedTotal += l.invoice;
      if (l.balance < 0) {
        e.missing += -l.balance;
        k.missing += -l.balance;
        missingTotal += -l.balance;
      }
      if (l.balance > 0) {
        e.surplus += l.balance;
        k.surplus += l.balance;
        surplusTotal += l.balance;
      }
      kinds.set(l.kind, k);
    }
    suppliers.set(key, e);
  }
  const divergentRows = conferred.filter((r) => r.lines.some((l) => l.balance !== null && l.balance !== 0));
  const divergence: DpvimDivergenceSummary = {
    checked: conferred.length,
    withDivergence: divergentRows.length,
    missing: missingTotal,
    surplus: surplusTotal,
    invoiced: invoicedTotal,
    missingRate: invoicedTotal > 0 ? Math.round((missingTotal / invoicedTotal) * 1000) / 10 : null,
    awaitingInvoice: showInvoice
      ? active.filter((r) => r.lines.some((l) => l.invoice === null)).map((r) => ({ id: r.id, code: r.code, origin: r.origin, kinds: r.lines.filter((l) => l.invoice === null).map((l) => l.kind), counted: r.doneQty }))
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
    rows,
    arrivalsByDay: [...arrivals.entries()].map(([dayKey, v]) => ({ dayKey, ...v })).sort((a, b) => a.dayKey.localeCompare(b.dayKey)),
    divergence,
    kinds: kindList.kinds,
    kindsReady: kindList.ready,
    byOrigin: [...origins.entries()].map(([origin, count]) => ({ origin, count })).sort((a, b) => b.count - a.count),
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
  return {
    row: toRow(d, sessions, new Date(), itemData),
    sessions: sessions.map((s) => toSessionRow(s, d.code, itemData)),
    canManage: canManageDpvim(user),
    canLaunch: await canLaunchDpvim(user),
    canSeeInvoice: showInvoice,
    mySession: openMine && openMine.dpvimId === id ? { id: openMine.id, startedAt: openMine.startedAt } : null,
    hasCollaborator: !!collab,
    collaborators: await db.collaborator.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    myCollaboratorId: collab?.id ?? null,
    kinds: (await listDpvimKinds()).kinds,
  };
}

/** `items` = o que veio, produto a produto, pela contagem do conferente (só um norte). A quantidade da NOTA é lançada à parte, por quem tem acesso a ela. */
export type DpvimInput = { origin: string; reference: string; material: string; items: { kind: string; qty: number }[]; arrivedAtIso: string; notes: string };

async function validate(input: DpvimInput, currentKinds: string[] = []) {
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
  if (input.origin.trim().length < 2) throw new Error("Informe de onde a DPVIM veio.");
  const arrivedAt = new Date(input.arrivedAtIso);
  if (Number.isNaN(arrivedAt.getTime())) throw new Error("Informe quando a DPVIM chegou.");
  if (arrivedAt.getTime() > Date.now() + 60 * 60 * 1000) throw new Error("A chegada não pode ser no futuro.");
  return arrivedAt;
}

export async function createDpvim(user: CurrentUser, input: DpvimInput) {
  if (!(await canLaunchDpvim(user))) throw new ForbiddenError();
  const arrivedAt = await validate(input);
  const code = await nextFriendlyCode("dpvim", "DPVIM", 4);
  const created = await db.$transaction(async (tx) => {
    const dpvim = await tx.dpvim.create({
      data: {
        code,
        kind: input.items[0].kind,
        origin: input.origin.trim().slice(0, 120),
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
  const arrivedAt = await validate(input, currentItems.length > 0 ? currentItems.map((i) => i.kind) : [before.kind]);
  const updated = await db.$transaction(async (tx) => {
    const dpvim = await tx.dpvim.update({
      where: { id },
      data: {
        kind: input.items[0].kind,
        origin: input.origin.trim().slice(0, 120),
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

/** `items` = quanto contaram de cada produto da DPVIM nesta atividade. */
export type StopInput = { items: { kind: string; qty: number }[]; qtyGood: number | null; qtyTransfer: number | null; qtyDiscard: number | null; notes: string; finish: boolean };

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
  const seen = new Set<string>();
  for (const it of input.items) {
    if (!allowed.includes(it.kind) || seen.has(it.kind)) throw new Error("Escolha só os produtos desta DPVIM, uma vez cada.");
    seen.add(it.kind);
    if (!Number.isInteger(it.qty) || it.qty < 0 || it.qty > 100000) throw new Error("Informe quantos itens foram feitos de cada produto.");
  }
  const qtyDone = input.items.reduce((s, i) => s + i.qty, 0);
  const qtyGood = optionalInt(input.qtyGood, "Bons");
  const qtyTransfer = optionalInt(input.qtyTransfer, "Transferência");
  const qtyDiscard = optionalInt(input.qtyDiscard, "Descarte");

  const now = new Date();
  const doneQty = d.doneQty + qtyDone;
  await db.$transaction(async (tx) => {
    await tx.dpvimSession.update({
      where: { id: sessionId },
      data: { stoppedAt: now, qtyDone, qtyGood, qtyTransfer, qtyDiscard, notes: input.notes.trim() ? input.notes.trim().slice(0, 500) : null },
    });
    const positive = input.items.filter((i) => i.qty > 0);
    if (positive.length > 0) await tx.dpvimSessionItem.createMany({ data: positive.map((i) => ({ sessionId, dpvimId: d.id, kind: i.kind, qty: i.qty })) });
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
  for (const s of sessions) await deleteStoredFile(s.startPhotoPath);
  await recordAudit({ userId: user.id, action: "CANCEL", entityType: "Dpvim", entityId: id, previousValue: { code: before.code, kind: before.kind, origin: before.origin, expectedQty: before.expectedQty, doneQty: before.doneQty, sessions: sessions.length } });
}
