import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import { nextFriendlyCode } from "@/server/services/sequence";
import type { CurrentUser } from "@/server/auth/current-user";
import { ForbiddenError, hasPermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { APP_TIMEZONE } from "@/lib/dates";
import { DPVIM_KINDS, dpvimSituation, dueAtFrom, progressPercent, type DpvimKind, type DpvimSituation, type DpvimStatus } from "@/domain/dpvim/rules";

/** Quem cadastra, edita e cancela DPVIM e vê o painel completo: gestão de produtividade, líderes que fazem chamada. */
export function canManageDpvim(user: CurrentUser): boolean {
  return hasPermission(user, PERMISSIONS.PRODUCTIVITY_MANAGE) || hasPermission(user, PERMISSIONS.PRODUCTIVITY_MANAGE_TEAM) || user.canRollCall;
}

/** Quem só acompanha o painel (auditor, RH, indicadores consolidados). */
export function canViewDpvimDashboard(user: CurrentUser): boolean {
  return canManageDpvim(user) || hasPermission(user, PERMISSIONS.PRODUCTIVITY_VIEW) || hasPermission(user, PERMISSIONS.INDICATORS_VIEW_CONSOLIDATED);
}

async function myCollaborator(user: CurrentUser) {
  return db.collaborator.findUnique({ where: { userId: user.id }, select: { id: true, name: true } });
}

/** Acesso à tela: gestão, quem acompanha, ou qualquer colaborador com login (o ajudante que executa). */
async function requireDpvimAccess(user: CurrentUser) {
  if (canManageDpvim(user) || canViewDpvimDashboard(user)) return null;
  const me = await myCollaborator(user);
  if (!me) throw new ForbiddenError();
  return me;
}

export type DpvimRow = {
  id: string;
  code: string;
  kind: DpvimKind;
  origin: string;
  reference: string | null;
  material: string | null;
  expectedQty: number;
  doneQty: number;
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
  qtyGood: number | null;
  qtyTransfer: number | null;
  qtyDiscard: number | null;
  notes: string | null;
};

type DpvimDb = Awaited<ReturnType<typeof db.dpvim.findMany>>[number];
type SessionDb = Awaited<ReturnType<typeof db.dpvimSession.findMany>>[number];

function toRow(d: DpvimDb, sessions: SessionDb[], now: Date): DpvimRow {
  const status = d.status as DpvimStatus;
  const { situation, hoursLeft } = dpvimSituation({ status, dueAt: d.dueAt, finishedAt: d.finishedAt }, now);
  const mine = sessions.filter((s) => s.dpvimId === d.id).sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  return {
    id: d.id,
    code: d.code,
    kind: d.kind as DpvimKind,
    origin: d.origin,
    reference: d.reference,
    material: d.material,
    expectedQty: d.expectedQty,
    doneQty: d.doneQty,
    progress: progressPercent(d.doneQty, d.expectedQty),
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

function toSessionRow(s: SessionDb, code: string): DpvimSessionRow {
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
    qtyGood: s.qtyGood,
    qtyTransfer: s.qtyTransfer,
    qtyDiscard: s.qtyDiscard,
    notes: s.notes,
  };
}

const dayKeyBrt = (d: Date) => formatInTimeZone(d, APP_TIMEZONE, "yyyy-MM-dd");

export type DpvimFilters = { from?: string | null; to?: string | null; kind?: DpvimKind | null; situation?: DpvimSituation | null };

export type DpvimDashboard = {
  ready: boolean;
  canManage: boolean;
  canSeeDashboard: boolean;
  /** A sessão que o usuário logado deixou aberta (para parar). */
  mySession: { id: string; dpvimId: string; dpvimCode: string; startedAt: Date; partnerName: string | null } | null;
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
  byPair: { label: string; qty: number; sessions: number }[];
  recent: DpvimSessionRow[];
  collaborators: { id: string; name: string }[];
};

/** Painel e fila de DPVIM. O período filtra pela chegada; as ainda não concluídas aparecem sempre (uma atrasada não some só porque é antiga). */
export async function getDpvimDashboard(user: CurrentUser, filters: DpvimFilters = {}): Promise<DpvimDashboard> {
  const me = await requireDpvimAccess(user);
  const manage = canManageDpvim(user);
  const seeDash = canViewDpvimDashboard(user);
  const now = new Date();
  const base: DpvimDashboard = {
    ready: true,
    canManage: manage,
    canSeeDashboard: seeDash,
    mySession: null,
    hasCollaborator: !!(me ?? (await myCollaborator(user))),
    myCollaboratorId: (me ?? (await myCollaborator(user)))?.id ?? null,
    kpis: { open: 0, inProgress: 0, late: 0, soon: 0, doneOnTime: 0, doneLate: 0, onTimeRate: null, avgLeadHours: null, totalExpected: 0, totalDone: 0 },
    rows: [],
    arrivalsByDay: [],
    byOrigin: [],
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

  const fromAt = filters.from ? new Date(`${filters.from}T00:00:00-03:00`) : null;
  const toAt = filters.to ? new Date(new Date(`${filters.to}T00:00:00-03:00`).getTime() + 24 * 60 * 60 * 1000) : null;
  const rowsAll = all.map((d) => toRow(d, sessions, now));
  const rows = rowsAll
    .filter((r) => {
      const finished = r.status === "CONCLUIDA" || r.status === "CANCELADA";
      if (!finished) return true;
      if (fromAt && r.arrivedAt < fromAt) return false;
      if (toAt && r.arrivedAt >= toAt) return false;
      return true;
    })
    .filter((r) => (filters.kind ? r.kind === filters.kind : true))
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
  // Nomes dos colegas ativos: servem para escolher a dupla ao abrir a DPVIM.
  const collaborators = await db.collaborator.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });

  return {
    ...base,
    mySession: mine ? { id: mine.id, dpvimId: mine.dpvimId, dpvimCode: codeById.get(mine.dpvimId) ?? "?", startedAt: mine.startedAt, partnerName: mine.partnerName } : null,
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
    byOrigin: [...origins.entries()].map(([origin, count]) => ({ origin, count })).sort((a, b) => b.count - a.count),
    byPair: [...pairs.entries()].map(([label, v]) => ({ label, ...v })).sort((a, b) => b.qty - a.qty),
    recent: periodSessions.slice(0, 15).map((s) => toSessionRow(s, codeById.get(s.dpvimId) ?? "?")),
    collaborators,
  };
}

export type DpvimDetail = {
  row: DpvimRow;
  sessions: DpvimSessionRow[];
  canManage: boolean;
  mySession: { id: string; startedAt: Date } | null;
  hasCollaborator: boolean;
  collaborators: { id: string; name: string }[];
  myCollaboratorId: string | null;
};

export async function getDpvimDetail(user: CurrentUser, id: string): Promise<DpvimDetail | null> {
  const me = await requireDpvimAccess(user);
  const d = await db.dpvim.findUnique({ where: { id } });
  if (!d) return null;
  const sessions = await db.dpvimSession.findMany({ where: { dpvimId: id }, orderBy: { startedAt: "desc" } });
  const collab = me ?? (await myCollaborator(user));
  const openMine = await db.dpvimSession.findFirst({ where: { userId: user.id, stoppedAt: null } });
  return {
    row: toRow(d, sessions, new Date()),
    sessions: sessions.map((s) => toSessionRow(s, d.code)),
    canManage: canManageDpvim(user),
    mySession: openMine && openMine.dpvimId === id ? { id: openMine.id, startedAt: openMine.startedAt } : null,
    hasCollaborator: !!collab,
    collaborators: await db.collaborator.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    myCollaboratorId: collab?.id ?? null,
  };
}

export type DpvimInput = { kind: string; origin: string; reference: string; material: string; expectedQty: number; arrivedAtIso: string; notes: string };

function validate(input: DpvimInput) {
  if (!DPVIM_KINDS.some((k) => k.key === input.kind)) throw new Error("Escolha se é de palete ou de chapatex.");
  if (input.origin.trim().length < 2) throw new Error("Informe de onde a DPVIM veio.");
  if (!Number.isInteger(input.expectedQty) || input.expectedQty <= 0 || input.expectedQty > 100000) throw new Error("Informe quantos itens vieram.");
  const arrivedAt = new Date(input.arrivedAtIso);
  if (Number.isNaN(arrivedAt.getTime())) throw new Error("Informe quando a DPVIM chegou.");
  if (arrivedAt.getTime() > Date.now() + 60 * 60 * 1000) throw new Error("A chegada não pode ser no futuro.");
  return arrivedAt;
}

export async function createDpvim(user: CurrentUser, input: DpvimInput) {
  if (!canManageDpvim(user)) throw new ForbiddenError();
  const arrivedAt = validate(input);
  const code = await nextFriendlyCode("dpvim", "DPVIM", 4);
  const created = await db.dpvim.create({
    data: {
      code,
      kind: input.kind,
      origin: input.origin.trim().slice(0, 120),
      reference: input.reference.trim() ? input.reference.trim().slice(0, 80) : null,
      material: input.material.trim() ? input.material.trim().slice(0, 300) : null,
      expectedQty: input.expectedQty,
      arrivedAt,
      dueAt: dueAtFrom(arrivedAt),
      notes: input.notes.trim() ? input.notes.trim().slice(0, 1000) : null,
      createdById: user.id,
      createdByName: user.name,
    },
  });
  await recordAudit({ userId: user.id, action: "CREATE", entityType: "Dpvim", entityId: created.id, newValue: { code, ...input } });
  return created;
}

export async function updateDpvim(user: CurrentUser, id: string, input: DpvimInput) {
  if (!canManageDpvim(user)) throw new ForbiddenError();
  const arrivedAt = validate(input);
  const before = await db.dpvim.findUniqueOrThrow({ where: { id } });
  const updated = await db.dpvim.update({
    where: { id },
    data: {
      kind: input.kind,
      origin: input.origin.trim().slice(0, 120),
      reference: input.reference.trim() ? input.reference.trim().slice(0, 80) : null,
      material: input.material.trim() ? input.material.trim().slice(0, 300) : null,
      expectedQty: input.expectedQty,
      arrivedAt,
      dueAt: dueAtFrom(arrivedAt),
      notes: input.notes.trim() ? input.notes.trim().slice(0, 1000) : null,
    },
  });
  await recordAudit({ userId: user.id, action: "UPDATE", entityType: "Dpvim", entityId: id, previousValue: before, newValue: input });
  return updated;
}

export async function setDpvimCancelled(user: CurrentUser, id: string, cancelled: boolean) {
  if (!canManageDpvim(user)) throw new ForbiddenError();
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

export type StopInput = { qtyDone: number; qtyGood: number | null; qtyTransfer: number | null; qtyDiscard: number | null; notes: string; finish: boolean };

function optionalInt(v: number | null, label: string): number | null {
  if (v === null) return null;
  if (!Number.isInteger(v) || v < 0 || v > 100000) throw new Error(`${label}: informe um número inteiro.`);
  return v;
}

/** O ajudante para a atividade: informa quanto fez. A DPVIM conclui sozinha ao atingir o total, ou quando ele marca que acabou. */
export async function stopDpvimSession(user: CurrentUser, sessionId: string, input: StopInput) {
  const session = await db.dpvimSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (session.userId !== user.id && !canManageDpvim(user)) throw new ForbiddenError();
  if (session.stoppedAt) throw new Error("Essa atividade já foi parada.");
  if (!Number.isInteger(input.qtyDone) || input.qtyDone < 0 || input.qtyDone > 100000) throw new Error("Informe quantos itens foram feitos.");
  const qtyGood = optionalInt(input.qtyGood, "Bons");
  const qtyTransfer = optionalInt(input.qtyTransfer, "Transferência");
  const qtyDiscard = optionalInt(input.qtyDiscard, "Descarte");

  const now = new Date();
  await db.dpvimSession.update({
    where: { id: sessionId },
    data: { stoppedAt: now, qtyDone: input.qtyDone, qtyGood, qtyTransfer, qtyDiscard, notes: input.notes.trim() ? input.notes.trim().slice(0, 500) : null },
  });
  const d = await db.dpvim.findUniqueOrThrow({ where: { id: session.dpvimId } });
  const doneQty = d.doneQty + input.qtyDone;
  const concluded = input.finish || doneQty >= d.expectedQty;
  await db.dpvim.update({
    where: { id: d.id },
    data: { doneQty, ...(concluded ? { status: "CONCLUIDA", finishedAt: now } : {}) },
  });
  await recordAudit({ userId: user.id, action: "UPDATE", entityType: "DpvimSession", entityId: sessionId, newValue: { ...input, code: d.code, concluded } });
  return { concluded };
}
