import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { hasPermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { APP_TIMEZONE } from "@/lib/dates";
import { resolveAutoValues, ytdKeyOf } from "@/server/services/cascade-auto.service";
import {
  diagnose,
  evaluateNode,
  isValidPeriodKey,
  rollupIvs,
  type CascadeKind,
  type CascadePace,
  type CascadePolarity,
  type CascadeUnit,
  type Diagnosis,
  type IvRollup,
  type NodeStatus,
} from "@/domain/cascade/status";
import { SEED_ICS, SEED_PERIOD, SEED_PILARES, SEED_SONHO } from "@/domain/cascade/seed-data";

/** ICs financeiros que leem do DRE importado (mês e acumulado do ano), pelo `seedKey` da estrutura inicial. Valor: chave do DRE;
 * "-" na frente do código troca o sinal (custos são negativos no DRE e o indicador é um % positivo). */
const SEED_DRE_KEYS: Record<string, string> = {
  "ic:gastos-totais": "dre.avr:-021",
  "ic:despesas-administrativas": "dre.avr:-158",
  "ic:pacote-de-manutencao": "dre.avr:114",
  "ic:ebitda": "dre.avr:233",
  "ic:pacote-de-gente": "dre.ratio:033",
  // TMA e TMC leem da planilha de controle de atendimento importada (tempo de atendimento: entrada no atendimento → liberação).
  "ic:tma": "tma.avg",
  "ic:tmc": "tma.tmc",
};

/**
 * Cascateamento de metas: árvore Sonho → Pilar → IC (O QUE) → IV (COMO) → IVs de IVs. Ver (gerente, auditor) exige
 * indicadores consolidados; criar/editar/atualizar resultado exige `cascade.manage`.
 */

export function canViewCascade(user: CurrentUser): boolean {
  return hasPermission(user, PERMISSIONS.INDICATORS_VIEW_CONSOLIDATED) || hasPermission(user, PERMISSIONS.CASCADE_MANAGE);
}
export function canManageCascade(user: CurrentUser): boolean {
  return hasPermission(user, PERMISSIONS.CASCADE_MANAGE);
}
function requireView(user: CurrentUser) {
  if (!canViewCascade(user)) throw new ForbiddenError();
}
function requireManage(user: CurrentUser) {
  if (!canManageCascade(user)) throw new ForbiddenError();
}

export type ValueSource = "MANUAL" | "IMPORT" | "AUTO" | "ANTERIOR";

export type CascadeTreeNode = {
  id: string;
  parentId: string | null;
  kind: CascadeKind;
  name: string;
  description: string | null;
  unit: CascadeUnit;
  polarity: CascadePolarity;
  pace: CascadePace;
  target: number | null;
  expected: number | null;
  /** Base da situação: o acumulado do ano (YTD) quando existe; senão o resultado do mês. */
  value: number | null;
  valueSource: ValueSource | null;
  valuePeriod: string | null;
  note: string | null;
  /** Resultado do mês selecionado e se ele bate a meta do mês. */
  monthValue: number | null;
  monthSource: ValueSource | null;
  monthStatus: NodeStatus;
  /** Acumulado do ano (YTD) até o mês selecionado (ou o último informado). */
  ytdValue: number | null;
  ytdSource: ValueSource | null;
  ytdPeriod: string | null;
  status: NodeStatus;
  progress: number | null;
  impact: string | null;
  sigoKey: string | null;
  reviewNote: string | null;
  owner: { id: string; name: string } | null;
  children: CascadeTreeNode[];
  /** Só IC: cruza o resultado com os IVs. */
  ivRollup: IvRollup | null;
  diagnosis: Diagnosis | null;
  /** Só PILAR/SONHO: quantos ICs abaixo em cada situação. */
  summary: { ok: number; fail: number; noData: number; withoutIv: number; total: number } | null;
};

export function currentPeriodKey(): string {
  return formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM");
}

export async function getCascadeTree(user: CurrentUser, periodKeyInput?: string) {
  requireView(user);
  const periodKey = periodKeyInput && isValidPeriodKey(periodKeyInput) ? periodKeyInput : currentPeriodKey();
  const todayKey = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");

  let nodes: LoadedNode[] = [];
  try {
    nodes = await loadNodes(periodKey);
  } catch (error) {
    console.error("[cascade] tabelas indisponíveis:", error);
    return { periodKey, roots: [] as CascadeTreeNode[], ready: false, canManage: canManageCascade(user), owners: [] as { id: string; name: string }[] };
  }

  nodes = nodes.map((n) => ({ ...n, sigoKey: n.sigoKey ?? SEED_DRE_KEYS[n.seedKey ?? ""] ?? null }));
  const autoKeys = nodes.filter((n) => n.sigoKey).flatMap((n) => [n.sigoKey!, ...(ytdKeyOf(n.sigoKey!) ? [ytdKeyOf(n.sigoKey!)!] : [])]);
  const auto = await resolveAutoValues(autoKeys, periodKey);

  const byId = new Map<string, CascadeTreeNode>();
  for (const n of nodes) {
    const exact = n.values.find((v) => v.periodKey === periodKey) ?? null;
    const previousYtd = n.values.filter((v) => v.periodKey < periodKey && v.ytd !== null).sort((a, b) => b.periodKey.localeCompare(a.periodKey))[0] ?? null;
    const autoMonth = n.sigoKey ? (auto.get(n.sigoKey) ?? null) : null;
    const ytdKey = n.sigoKey ? ytdKeyOf(n.sigoKey) : null;
    const autoYtd = ytdKey ? (auto.get(ytdKey) ?? null) : null;

    // Resultado do MÊS: o digitado/importado do mês; senão o automático do SIGO. Não "herda" de mês anterior.
    let monthValue: number | null = null;
    let monthSource: ValueSource | null = null;
    if (exact && exact.value !== null) {
      monthValue = exact.value;
      monthSource = exact.source as ValueSource;
    } else if (autoMonth !== null) {
      monthValue = autoMonth;
      monthSource = "AUTO";
    }
    // ACUMULADO do ano: o do mês; senão a soma automática; senão o último informado (o YTD vale até alguém atualizar).
    let ytdValue: number | null = null;
    let ytdSource: ValueSource | null = null;
    let ytdPeriod: string | null = null;
    if (exact && exact.ytd !== null) {
      ytdValue = exact.ytd;
      ytdSource = exact.source as ValueSource;
      ytdPeriod = periodKey;
    } else if (autoYtd !== null) {
      ytdValue = autoYtd;
      ytdSource = "AUTO";
      ytdPeriod = periodKey;
    } else if (previousYtd) {
      ytdValue = previousYtd.ytd;
      ytdSource = "ANTERIOR";
      ytdPeriod = previousYtd.periodKey;
    }
    const note = exact?.note ?? (previousYtd && ytdSource === "ANTERIOR" ? previousYtd.note : null);

    // A situação usa o acumulado (como a planilha); sem acumulado, o resultado do mês.
    const value = ytdValue ?? monthValue;
    const valueSource = ytdValue !== null ? ytdSource : monthSource;
    const valuePeriod = ytdValue !== null ? ytdPeriod : value !== null ? periodKey : null;
    const polarity = n.polarity as CascadePolarity;
    const pace = n.pace as CascadePace;
    const measured = n.kind === "IC" || n.kind === "IV";
    const evaluation = measured
      ? evaluateNode({ value, target: n.target, polarity, pace, periodKey: valuePeriod ?? periodKey, todayKey })
      : { status: "NO_DATA" as NodeStatus, expected: null, progress: null };
    // Meta do mês: a anual dividida por 12 (quando a meta é anual e maior é melhor); senão a própria meta.
    const monthTarget = n.target !== null && pace === "YEAR" && polarity === "HIGHER" ? n.target / 12 : n.target;
    const monthEvaluation = measured
      ? evaluateNode({ value: monthValue, target: monthTarget, polarity, pace: pace === "MONTH" ? "MONTH" : "NONE", periodKey, todayKey })
      : { status: "NO_DATA" as NodeStatus };
    byId.set(n.id, {
      id: n.id,
      parentId: n.parentId,
      kind: n.kind as CascadeKind,
      name: n.name,
      description: n.description,
      unit: n.unit as CascadeUnit,
      polarity: n.polarity as CascadePolarity,
      pace: n.pace as CascadePace,
      target: n.target,
      expected: evaluation.expected,
      value,
      valueSource,
      valuePeriod,
      note,
      monthValue,
      monthSource,
      monthStatus: monthEvaluation.status,
      ytdValue,
      ytdSource,
      ytdPeriod,
      status: evaluation.status,
      progress: evaluation.progress,
      impact: n.impact,
      sigoKey: n.sigoKey,
      reviewNote: n.reviewNote,
      owner: n.owner ? { id: n.owner.id, name: n.owner.name } : null,
      children: [],
      ivRollup: null,
      diagnosis: null,
      summary: null,
    });
  }

  const roots: CascadeTreeNode[] = [];
  const order = new Map(nodes.map((n, i) => [n.id, i]));
  for (const n of nodes) {
    const node = byId.get(n.id)!;
    const parent = n.parentId ? byId.get(n.parentId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sortChildren = (list: CascadeTreeNode[]) => {
    list.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    list.forEach((c) => sortChildren(c.children));
  };
  sortChildren(roots);

  // Todos os IVs abaixo de um nó (qualquer profundidade) entram no resumo do IC.
  const collectIvStatuses = (node: CascadeTreeNode): NodeStatus[] =>
    node.children.flatMap((c) => (c.kind === "IV" ? [c.status, ...collectIvStatuses(c)] : []));
  const decorate = (node: CascadeTreeNode) => {
    node.children.forEach(decorate);
    if (node.kind === "IC") {
      node.ivRollup = rollupIvs(collectIvStatuses(node));
      node.diagnosis = diagnose(node.status, node.ivRollup);
    }
    if (node.kind === "PILAR" || node.kind === "SONHO") {
      const ics: CascadeTreeNode[] = [];
      const walk = (n: CascadeTreeNode) => n.children.forEach((c) => (c.kind === "IC" ? ics.push(c) : walk(c)));
      walk(node);
      node.summary = {
        total: ics.length,
        ok: ics.filter((c) => c.status === "OK").length,
        fail: ics.filter((c) => c.status === "FAIL").length,
        noData: ics.filter((c) => c.status === "NO_DATA" || c.status === "NO_TARGET").length,
        withoutIv: ics.filter((c) => c.ivRollup === "NONE").length,
      };
    }
  };
  roots.forEach(decorate);

  const owners = canManageCascade(user)
    ? await db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];
  return { periodKey, roots, ready: true, canManage: canManageCascade(user), owners };
}

type LoadedNode = Awaited<ReturnType<typeof loadNodesWithYtd>>[number];

async function loadNodesWithYtd(periodKey: string) {
  return db.cascadeNode.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      owner: { select: { id: true, name: true } },
      values: { where: { periodKey: { lte: periodKey } }, select: { periodKey: true, value: true, ytd: true, source: true, note: true } },
    },
  });
}

/** Lê a árvore. Se a coluna do acumulado (ytd) ainda não existe no banco (migração pendente), lê sem ela. */
async function loadNodes(periodKey: string): Promise<LoadedNode[]> {
  try {
    return await loadNodesWithYtd(periodKey);
  } catch (error) {
    console.error("[cascade] lendo sem a coluna ytd (migração pendente?):", error);
    const nodes = await db.cascadeNode.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        owner: { select: { id: true, name: true } },
        values: { where: { periodKey: { lte: periodKey } }, select: { periodKey: true, value: true, source: true, note: true } },
      },
    });
    return nodes.map((n) => ({ ...n, values: n.values.map((v) => ({ ...v, ytd: null as number | null })) }));
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Edição (gerente)
// ---------------------------------------------------------------------------------------------------------------------

export type NodeInput = {
  name: string;
  description?: string | null;
  unit: CascadeUnit;
  polarity: CascadePolarity;
  pace: CascadePace;
  target: number | null;
  ownerUserId: string | null;
  impact?: string | null;
};

function validateInput(input: NodeInput) {
  if (input.name.trim().length < 2) throw new ForbiddenError("Informe o nome.");
  if (!["PERCENT", "NUMBER", "MINUTES", "DAYS", "MONEY"].includes(input.unit)) throw new ForbiddenError("Unidade inválida.");
  if (!["HIGHER", "LOWER"].includes(input.polarity)) throw new ForbiddenError("Sentido da meta inválido.");
  if (!["NONE", "YEAR", "MONTH"].includes(input.pace)) throw new ForbiddenError("Ritmo da meta inválido.");
  if (input.target !== null && !Number.isFinite(input.target)) throw new ForbiddenError("Meta inválida.");
}

export async function createNode(user: CurrentUser, parentId: string, kind: "IC" | "IV", input: NodeInput) {
  requireManage(user);
  validateInput(input);
  const parent = await db.cascadeNode.findUnique({ where: { id: parentId }, select: { id: true, kind: true } });
  if (!parent) throw new ForbiddenError("Nó pai não encontrado.");
  if (kind === "IC" && parent.kind !== "PILAR") throw new ForbiddenError("Um IC fica dentro de um pilar.");
  if (kind === "IV" && parent.kind !== "IC" && parent.kind !== "IV") throw new ForbiddenError("Um IV fica dentro de um IC ou de outro IV.");
  const last = await db.cascadeNode.findFirst({ where: { parentId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const created = await db.cascadeNode.create({
    data: {
      parentId,
      kind,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      unit: input.unit,
      polarity: input.polarity,
      pace: input.pace,
      target: input.target,
      ownerUserId: input.ownerUserId,
      impact: input.impact ?? null,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
  await recordAudit({ userId: user.id, action: "CREATE", entityType: "CascadeNode", entityId: created.id, newValue: { parentId, kind, ...input } });
  return created;
}

export type Placement = { kind: "IC" | "IV"; parentId: string };

/** Valida e resolve onde um IC/IV passa a ficar: IC dentro de um pilar; IV dentro de um IC ou de outro IV — nunca dentro de si
 * mesmo nem de algo que está abaixo dele (senão a árvore vira um laço). */
async function resolvePlacement(id: string, placement: Placement) {
  if (placement.kind !== "IC" && placement.kind !== "IV") throw new ForbiddenError("Tipo inválido.");
  const all = await db.cascadeNode.findMany({ select: { id: true, parentId: true, kind: true } });
  const byId = new Map(all.map((n) => [n.id, n]));
  const parent = byId.get(placement.parentId);
  if (!parent) throw new ForbiddenError("Escolha onde o item fica.");
  const descendants = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const current = stack.pop()!;
    for (const n of all) if (n.parentId === current && !descendants.has(n.id)) {
      descendants.add(n.id);
      stack.push(n.id);
    }
  }
  if (placement.parentId === id || descendants.has(placement.parentId)) throw new ForbiddenError("O item não pode ficar dentro dele mesmo nem de algo que está abaixo dele.");
  if (placement.kind === "IC" && parent.kind !== "PILAR") throw new ForbiddenError("Um IC fica dentro de um pilar.");
  if (placement.kind === "IV" && parent.kind !== "IC" && parent.kind !== "IV") throw new ForbiddenError("Um IV fica dentro de um IC ou de outro IV.");
}

export async function updateNode(user: CurrentUser, id: string, input: NodeInput, placement?: Placement) {
  requireManage(user);
  validateInput(input);
  const before = await db.cascadeNode.findUnique({ where: { id } });
  if (!before) throw new ForbiddenError("Nó não encontrado.");
  let move: { kind: string; parentId: string; sortOrder?: number } | null = null;
  if (placement) {
    if (before.kind !== "IC" && before.kind !== "IV") throw new ForbiddenError("O sonho e os pilares não mudam de lugar.");
    await resolvePlacement(id, placement);
    const parentChanged = before.parentId !== placement.parentId;
    const last = parentChanged ? await db.cascadeNode.findFirst({ where: { parentId: placement.parentId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } }) : null;
    move = { kind: placement.kind, parentId: placement.parentId, ...(parentChanged ? { sortOrder: (last?.sortOrder ?? 0) + 1 } : {}) };
  }
  const updated = await db.cascadeNode.update({
    where: { id },
    data: {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      unit: input.unit,
      polarity: input.polarity,
      pace: input.pace,
      target: input.target,
      ownerUserId: input.ownerUserId,
      reviewNote: null, // quem confirmou/ajustou o sentido da meta resolveu a dúvida
      ...(move ?? {}),
    },
  });
  await recordAudit({
    userId: user.id,
    action: "UPDATE",
    entityType: "CascadeNode",
    entityId: id,
    previousValue: { name: before.name, kind: before.kind, parentId: before.parentId, unit: before.unit, polarity: before.polarity, pace: before.pace, target: before.target, ownerUserId: before.ownerUserId },
    newValue: { ...input, ...(placement ?? {}) },
  });
  return updated;
}

export async function deleteNode(user: CurrentUser, id: string) {
  requireManage(user);
  const node = await db.cascadeNode.findUnique({ where: { id }, select: { id: true, kind: true, name: true } });
  if (!node) throw new ForbiddenError("Nó não encontrado.");
  if (node.kind === "SONHO" || node.kind === "PILAR") throw new ForbiddenError("O sonho e os pilares não são excluídos por aqui.");
  await db.cascadeNode.delete({ where: { id } }); // os IVs abaixo vão junto (cascade)
  await recordAudit({ userId: user.id, action: "DELETE", entityType: "CascadeNode", entityId: id, previousValue: { kind: node.kind, name: node.name } });
}

export async function setNodeValue(user: CurrentUser, id: string, periodKey: string, month: number | null, ytd: number | null, note: string) {
  requireManage(user);
  if (!isValidPeriodKey(periodKey)) throw new ForbiddenError("Período inválido.");
  if ((month !== null && !Number.isFinite(month)) || (ytd !== null && !Number.isFinite(ytd))) throw new ForbiddenError("Valor inválido.");
  if (month === null && ytd === null) {
    await db.cascadeValue.deleteMany({ where: { nodeId: id, periodKey } });
  } else {
    await db.cascadeValue.upsert({
      where: { nodeId_periodKey: { nodeId: id, periodKey } },
      update: { value: month, ytd, note: note.trim() || null, source: "MANUAL", updatedById: user.id },
      create: { nodeId: id, periodKey, value: month, ytd, note: note.trim() || null, source: "MANUAL", updatedById: user.id },
    });
  }
  await recordAudit({ userId: user.id, action: "UPDATE", entityType: "CascadeValue", entityId: id, newValue: { periodKey, month, ytd, note } });
}

// ---------------------------------------------------------------------------------------------------------------------
// Estrutura inicial (planilha SWOT + 3 ICs abertos até o último nível)
// ---------------------------------------------------------------------------------------------------------------------

type SeedNode = {
  seedKey: string;
  parentSeedKey: string;
  kind: "IC" | "IV";
  name: string;
  unit?: CascadeUnit;
  polarity?: CascadePolarity;
  pace?: CascadePace;
  target?: number | null;
  sigoKey?: string;
  description?: string;
};

const IC_SIGO: Record<string, string> = {
  "dto-dmpeople": "dto.month.count",
  "qlp-relatando": "guardian.reporters.pct",
  "check-list-empilhadeira": "forklift.checklist.pct",
};

/** IVs dos 3 ICs de exemplo — o COMO. Onde não há meta definida, o nó fica sem meta até o gerente informar. */
const STATIC_IVS: SeedNode[] = [
  // DTO (DMPeople) — 216 no ano
  { seedKey: "iv:dto:semana", parentSeedKey: "ic:dto-dmpeople", kind: "IV", name: "Fazer 4,5 DTOs por semana", unit: "NUMBER", target: 4.5, sigoKey: "dto.last7.count", description: "216 DTOs no ano ÷ 48 semanas. Conta os DTOs dos últimos 7 dias." },
  { seedKey: "iv:dto:mes", parentSeedKey: "iv:dto:semana", kind: "IV", name: "Fechar 18 DTOs no mês", unit: "NUMBER", target: 18, pace: "MONTH", sigoKey: "dto.month.count", description: "216 ÷ 12. No mês corrente a meta é proporcional aos dias." },
  { seedKey: "iv:dto:novatos", parentSeedKey: "ic:dto-dmpeople", kind: "IV", name: "Novatos avaliados (menos de 60 dias de casa)", unit: "PERCENT", target: 100, sigoKey: "dto.newhires.pct", description: "Todo novato precisa ter DTO." },
  { seedKey: "iv:dto:cobertura", parentSeedKey: "ic:dto-dmpeople", kind: "IV", name: "Todo o time avaliado a cada 60 dias", unit: "PERCENT", target: 100, sigoKey: "dto.coverage60.pct", description: "DTO ou justificativa nos últimos 60 dias." },
  { seedKey: "iv:dto:incidente", parentSeedKey: "ic:dto-dmpeople", kind: "IV", name: "DTO pós-incidente realizado", unit: "PERCENT", target: 100, sigoKey: "dto.incident.pct", description: "Todo incidente (acidente típico, quase acidente ou FAI) gera DTO com o colaborador." },
  // QLP Relatando
  { seedKey: "iv:qlp:ninguem", parentSeedKey: "ic:qlp-relatando", kind: "IV", name: "Ninguém sem relatar no mês", unit: "NUMBER", polarity: "LOWER", target: 0, sigoKey: "guardian.notreported.count", description: "Colaboradores ativos sem nenhum relato no mês." },
  { seedKey: "iv:qlp:relatos", parentSeedKey: "ic:qlp-relatando", kind: "IV", name: "Relatos registrados no mês", unit: "NUMBER", target: null, sigoKey: "guardian.reports.count", description: "Sem meta ainda: informe quantos relatos por mês fecham o IC." },
  // TMA — tempo de atendimento (entrada no atendimento → liberação), aberto nas etapas que o formam
  { seedKey: "iv:tma:ate3h", parentSeedKey: "ic:tma", kind: "IV", name: "Atender os caminhões em até 3 horas", unit: "PERCENT", target: null, sigoKey: "tma.within3h", description: "% dos caminhões liberados com atendimento de 3h ou menos. Sem meta ainda: informe quantos % fecham o TMA." },
  { seedKey: "iv:tma:espera", parentSeedKey: "ic:tma", kind: "IV", name: "Espera no armazém depois de entrar no atendimento", unit: "MINUTES", polarity: "LOWER", target: null, sigoKey: "tma.stage:espera", description: "Da entrada no atendimento até o início do carregamento." },
  { seedKey: "iv:tma:carga", parentSeedKey: "ic:tma", kind: "IV", name: "Carregamento (TMC)", unit: "MINUTES", polarity: "LOWER", target: 60, sigoKey: "tma.stage:carregamento", description: "Do início ao fim do carregamento. Meta de 1h, da planilha de metas." },
  { seedKey: "iv:tma:amarracao", parentSeedKey: "ic:tma", kind: "IV", name: "Amarração", unit: "MINUTES", polarity: "LOWER", target: null, sigoKey: "tma.stage:amarracao", description: "Do fim do carregamento ao fim da amarração." },
  { seedKey: "iv:tma:liberacao", parentSeedKey: "ic:tma", kind: "IV", name: "Liberação do veículo", unit: "MINUTES", polarity: "LOWER", target: null, sigoKey: "tma.stage:liberacao", description: "Do fim da amarração à saída do caminhão." },
  { seedKey: "iv:tma:ambev", parentSeedKey: "ic:tma", kind: "IV", name: "TMA da planilha da Ambev (com a espera no pátio)", unit: "MINUTES", polarity: "LOWER", target: 180, sigoKey: "tma.ambev", description: "O TMA da planilha da Ambev: conta a espera no pátio de quem chega antes do agendamento." },
  // Check list empilhadeira
  { seedKey: "iv:emp:diario", parentSeedKey: "ic:check-list-empilhadeira", kind: "IV", name: "Toda empilhadeira com checklist todo dia", unit: "PERCENT", target: 100, sigoKey: "forklift.checklist.pct", description: "% de empilhadeira-dia com checklist concluído no mês (só dias fechados; bloqueadas ficam de fora)." },
  { seedKey: "iv:emp:liberadas", parentSeedKey: "ic:check-list-empilhadeira", kind: "IV", name: "Empilhadeiras liberadas para uso", unit: "PERCENT", target: null, sigoKey: "forklift.available.pct", description: "Sem meta ainda: informe o mínimo de empilhadeiras liberadas." },
];

export async function seedCascade(user: CurrentUser) {
  requireManage(user);
  const ids = new Map<string, string>();
  let created = 0;
  let order = 0;

  async function ensure(seedKey: string, data: Parameters<typeof db.cascadeNode.create>[0]["data"]) {
    const existing = await db.cascadeNode.findUnique({ where: { seedKey }, select: { id: true } });
    if (existing) {
      ids.set(seedKey, existing.id);
      return existing.id;
    }
    const node = await db.cascadeNode.create({ data: { ...data, seedKey, sortOrder: order++ } });
    ids.set(seedKey, node.id);
    created++;
    return node.id;
  }

  const sonhoId = await ensure("sonho", { kind: "SONHO", name: SEED_SONHO, unit: "NUMBER" });
  for (const pilar of SEED_PILARES) {
    await ensure(`pilar:${pilar}`, { kind: "PILAR", name: pilar.toUpperCase(), parentId: sonhoId });
  }
  for (const ic of SEED_ICS) {
    const seedKey = `ic:${ic.key}`;
    const wasThere = await db.cascadeNode.findUnique({ where: { seedKey }, select: { id: true } });
    const id = await ensure(seedKey, {
      kind: "IC",
      name: ic.name,
      parentId: ids.get(`pilar:${ic.pilar}`)!,
      unit: ic.unit,
      polarity: ic.polarity,
      pace: ic.pace,
      target: ic.target,
      impact: ic.impact,
      sigoKey: IC_SIGO[ic.key] ?? null,
      reviewNote: ic.review,
    });
    if (!wasThere) {
      await db.cascadeValue.create({
        data: { nodeId: id, periodKey: SEED_PERIOD, ytd: ic.value, note: "Acumulado do ano até set/2026 (planilha SWOT)", source: "IMPORT", updatedById: user.id },
      });
    }
  }

  for (const iv of STATIC_IVS) {
    await ensure(iv.seedKey, {
      kind: "IV",
      name: iv.name,
      parentId: ids.get(iv.parentSeedKey) ?? (await db.cascadeNode.findUnique({ where: { seedKey: iv.parentSeedKey }, select: { id: true } }))?.id,
      unit: iv.unit ?? "NUMBER",
      polarity: iv.polarity ?? "HIGHER",
      pace: iv.pace ?? "NONE",
      target: iv.target ?? null,
      sigoKey: iv.sigoKey ?? null,
      description: iv.description ?? null,
    });
  }

  // Desdobramento até o último nível: por turno (relatos) e por empilhadeira (checklist).
  const qlpIv = ids.get("iv:qlp:ninguem") ?? (await db.cascadeNode.findUnique({ where: { seedKey: "iv:qlp:ninguem" }, select: { id: true } }))?.id;
  if (qlpIv) {
    const turnos = await db.turno.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
    for (const t of turnos) {
      await ensure(`iv:qlp:turno:${t.id}`, {
        kind: "IV",
        name: `Turno ${t.name.replace(/^turno\s+/i, "")} sem ninguém sem relatar`,
        parentId: qlpIv,
        unit: "NUMBER",
        polarity: "LOWER",
        target: 0,
        sigoKey: `guardian.notreported.turno:${t.id}`,
        description: "Colaboradores do turno sem relato no mês.",
      });
    }
  }
  const empIv = ids.get("iv:emp:diario") ?? (await db.cascadeNode.findUnique({ where: { seedKey: "iv:emp:diario" }, select: { id: true } }))?.id;
  if (empIv) {
    const forklifts = await db.equipment.findMany({
      where: { active: true, type: { name: { contains: "empilhadeira", mode: "insensitive" } } },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    });
    for (const f of forklifts) {
      await ensure(`iv:emp:eq:${f.id}`, {
        kind: "IV",
        name: `${f.code} — ${f.name}: checklist todo dia`,
        parentId: empIv,
        unit: "PERCENT",
        target: 100,
        sigoKey: `forklift.checklist.eq:${f.id}`,
        description: "% dos dias fechados do mês com checklist concluído nesta empilhadeira.",
      });
    }
  }

  await recordAudit({ userId: user.id, action: "CREATE", entityType: "CascadeNode", entityId: sonhoId, newValue: { seed: true, created } });
  return { created };
}
