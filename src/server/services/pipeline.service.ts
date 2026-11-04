import "server-only";
import ExcelJS from "exceljs";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import {
  CRITICALITY,
  ICC_RESULTS,
  ORIGIN,
  POSITION_STATUS,
  POTENTIAL,
  READINESS,
  cycleBands,
  isTurnoverRisk,
  monthsBetween,
  parseCriticality,
  parseDue,
  parseIccResult,
  parseOrigin,
  parsePositionStatus,
  parsePotential,
  parseReadiness,
  positionRisk,
  summarizePositions,
  tenureSummary,
  type PositionRisk,
} from "@/domain/pipeline/rules";

const RH = PERMISSIONS.HR_MANAGE;

export type PositionRow = {
  id: string;
  cargo: string;
  area: string | null;
  criticality: string;
  occupant: string | null;
  successor1: string | null;
  successor2: string | null;
  origin: string | null;
  readiness: string | null;
  potential: string | null;
  gap: string | null;
  action: string | null;
  dueDate: Date | null;
  dueNote: string | null;
  status: string | null;
  risk: PositionRisk;
};

export type CycleRow = {
  id: string;
  cycleYear: number;
  name: string;
  leader: string | null;
  cycleType: string | null;
  icc: number | null;
  iccResult: string | null;
  ir: number | null;
  irResult: string | null;
  selfEval: string | null;
  perfEval: string | null;
  finalClass: string | null;
  situation: string | null;
  follow: string | null;
};

export type PipelineView = {
  ready: boolean;
  year: number;
  years: number[];
  tenure: ReturnType<typeof tenureSummary>;
  cycle: { entries: CycleRow[]; bands: ReturnType<typeof cycleBands>; risk: CycleRow[] };
  positions: PositionRow[];
  summary: ReturnType<typeof summarizePositions>;
  collaboratorNames: string[];
  /** Colaboradores ativos com a função, para sugerir nomes nos formulários. */
  people: { name: string; functionName: string | null }[];
};

const str = (v: unknown, max = 300): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, max) : null);
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) ? n : null;
};

const toPosition = (r: {
  id: string;
  cargo: string;
  area: string | null;
  criticality: string;
  occupant: string | null;
  successor1: string | null;
  successor2: string | null;
  origin: string | null;
  readiness: string | null;
  potential: string | null;
  gap: string | null;
  action: string | null;
  dueDate: Date | null;
  dueNote: string | null;
  status: string | null;
}): PositionRow => ({ ...r, risk: positionRisk(r.criticality, r.readiness) });

/** Pipeline do ano: tempo de casa de quem está ativo, faixas e lista de risco do Ciclo de Gente, e o plano de sucessão. Tolerante: sem as tabelas, só o tempo de casa. */
export async function getPipelineView(user: CurrentUser, year: number): Promise<PipelineView> {
  requirePermission(user, RH);
  const now = new Date();
  const collaborators = await db.collaborator.findMany({ where: { active: true }, select: { name: true, admissionDate: true, function: { select: { name: true } } }, orderBy: { name: "asc" } });
  const tenure = tenureSummary(collaborators.filter((c) => c.admissionDate).map((c) => monthsBetween(c.admissionDate as Date, now)));

  let ready = true;
  let entries: CycleRow[] = [];
  let years: number[] = [year];
  let positions: PositionRow[] = [];
  try {
    const [cycleRows, cycleYears, positionRows] = await Promise.all([
      db.peopleCycleEntry.findMany({ where: { cycleYear: year }, orderBy: { name: "asc" } }),
      db.peopleCycleEntry.findMany({ distinct: ["cycleYear"], select: { cycleYear: true } }),
      db.successionPosition.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    ]);
    entries = cycleRows.map((r) => ({ id: r.id, cycleYear: r.cycleYear, name: r.name, leader: r.leader, cycleType: r.cycleType, icc: r.icc, iccResult: r.iccResult, ir: r.ir, irResult: r.irResult, selfEval: r.selfEval, perfEval: r.perfEval, finalClass: r.finalClass, situation: r.situation, follow: r.follow }));
    years = [...new Set([year, ...cycleYears.map((y) => y.cycleYear)])].sort((a, b) => b - a);
    positions = positionRows.map(toPosition);
  } catch (error) {
    console.error("[pipeline] tabelas indisponíveis:", error);
    ready = false;
  }

  return {
    ready,
    year,
    years,
    tenure,
    cycle: { entries, bands: cycleBands(entries), risk: entries.filter(isTurnoverRisk) },
    positions,
    summary: summarizePositions(positions),
    collaboratorNames: collaborators.map((c) => c.name),
    people: collaborators.map((c) => ({ name: c.name, functionName: c.function?.name ?? null })),
  };
}

// ── Plano de sucessão ──

export type PositionInput = {
  cargo: string;
  area?: string | null;
  criticality: string;
  occupant?: string | null;
  successor1?: string | null;
  successor2?: string | null;
  origin?: string | null;
  readiness?: string | null;
  potential?: string | null;
  gap?: string | null;
  action?: string | null;
  dueDate?: string | null; // AAAA-MM-DD
  dueNote?: string | null;
  status?: string | null;
};

const oneOf = (list: readonly { key: string }[], v: string | null | undefined): string | null => (v && list.some((i) => i.key === v) ? v : null);

function positionData(input: PositionInput) {
  const cargo = str(input.cargo, 160);
  if (!cargo) throw new Error("Informe o cargo.");
  const due = input.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) ? new Date(`${input.dueDate}T12:00:00Z`) : null;
  return {
    cargo,
    area: str(input.area, 120),
    criticality: oneOf(CRITICALITY, input.criticality) ?? "MEDIA",
    occupant: str(input.occupant, 160),
    successor1: str(input.successor1, 160),
    successor2: str(input.successor2, 160),
    origin: oneOf(ORIGIN, input.origin),
    readiness: oneOf(READINESS, input.readiness),
    potential: oneOf(POTENTIAL, input.potential),
    gap: str(input.gap, 160),
    action: str(input.action, 600),
    dueDate: due,
    dueNote: str(input.dueNote, 120),
    status: oneOf(POSITION_STATUS, input.status),
  };
}

export async function savePosition(user: CurrentUser, id: string | null, input: PositionInput) {
  requirePermission(user, RH);
  const data = { ...positionData(input), updatedById: user.id };
  const saved = id
    ? await db.successionPosition.update({ where: { id }, data })
    : await db.successionPosition.create({ data: { ...data, sortOrder: (await db.successionPosition.count()) + 1 } });
  await recordAudit({ userId: user.id, action: id ? "UPDATE" : "CREATE", entityType: "SuccessionPosition", entityId: saved.id, newValue: { cargo: data.cargo, criticality: data.criticality } });
  return saved.id;
}

export async function deletePosition(user: CurrentUser, id: string) {
  requirePermission(user, RH);
  const before = await db.successionPosition.findUniqueOrThrow({ where: { id } });
  await db.successionPosition.delete({ where: { id } });
  await recordAudit({ userId: user.id, action: "DELETE", entityType: "SuccessionPosition", entityId: id, previousValue: { cargo: before.cargo } });
}

// ── Ciclo de Gente ──

export type CycleInput = {
  cycleYear: number;
  name: string;
  leader?: string | null;
  cycleType?: string | null;
  icc?: number | string | null;
  iccResult?: string | null;
  ir?: number | string | null;
  irResult?: string | null;
  selfEval?: string | null;
  perfEval?: string | null;
  finalClass?: string | null;
  situation?: string | null;
  follow?: string | null;
};

function cycleData(input: CycleInput) {
  const name = str(input.name, 160);
  if (!name) throw new Error("Informe o colaborador.");
  if (!Number.isInteger(input.cycleYear) || input.cycleYear < 2020 || input.cycleYear > 2100) throw new Error("Ano inválido.");
  return {
    cycleYear: input.cycleYear,
    name,
    leader: str(input.leader, 160),
    cycleType: str(input.cycleType, 80),
    icc: num(input.icc),
    iccResult: oneOf(ICC_RESULTS, input.iccResult) ?? "NAO_INFORMADO",
    ir: num(input.ir),
    irResult: str(input.irResult, 80),
    selfEval: str(input.selfEval, 80),
    perfEval: str(input.perfEval, 80),
    finalClass: str(input.finalClass, 80),
    situation: str(input.situation, 300),
    follow: str(input.follow, 300),
  };
}

export async function saveCycleEntry(user: CurrentUser, id: string | null, input: CycleInput) {
  requirePermission(user, RH);
  const data = { ...cycleData(input), updatedById: user.id };
  const saved = id ? await db.peopleCycleEntry.update({ where: { id }, data }) : await db.peopleCycleEntry.create({ data });
  await recordAudit({ userId: user.id, action: id ? "UPDATE" : "CREATE", entityType: "PeopleCycleEntry", entityId: saved.id, newValue: { name: data.name, year: data.cycleYear, iccResult: data.iccResult } });
  return saved.id;
}

/** Situação atual e follow de quem está na lista de risco (o que o RH combinou com a pessoa e o líder). */
export async function saveRiskFollow(user: CurrentUser, id: string, input: { situation?: string | null; follow?: string | null }) {
  requirePermission(user, RH);
  await db.peopleCycleEntry.update({ where: { id }, data: { situation: str(input.situation, 300), follow: str(input.follow, 300), updatedById: user.id } });
  await recordAudit({ userId: user.id, action: "UPDATE", entityType: "PeopleCycleEntry", entityId: id, newValue: { follow: true } });
}

export async function deleteCycleEntry(user: CurrentUser, id: string) {
  requirePermission(user, RH);
  const before = await db.peopleCycleEntry.findUniqueOrThrow({ where: { id } });
  await db.peopleCycleEntry.delete({ where: { id } });
  await recordAudit({ userId: user.id, action: "DELETE", entityType: "PeopleCycleEntry", entityId: id, previousValue: { name: before.name, year: before.cycleYear } });
}

// ── Importação da planilha de gestão do pipeline ──

export type ParsedPosition = PositionInput & { row: number };
export type ParsedCycle = CycleInput & { row: number };
export type PipelineWorkbook = { positions: ParsedPosition[]; cycles: ParsedCycle[]; notes: string[] };

function cellText(value: ExcelJS.CellValue | undefined): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((t) => t.text).join("").trim();
    if ("result" in value && value.result !== undefined && value.result !== null) return cellText(value.result as ExcelJS.CellValue);
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    return "";
  }
  return String(value).trim();
}

const fold = (s: string) =>
  Array.from(s.normalize("NFD"))
    .filter((ch) => ch.codePointAt(0)! < 0x300)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

function findSheet(workbook: ExcelJS.Workbook, includes: string): ExcelJS.Worksheet | undefined {
  return workbook.worksheets.find((w) => fold(w.name).includes(fold(includes)));
}

/**
 * Lê a planilha de gestão do pipeline: o Plano de Sucessão da aba "Pipeline" (a partir da linha de títulos que começa com "Cargo") e o Ciclo de Gente da aba
 * "Ciclo de Gente" (títulos na primeira linha). Não grava nada: devolve o que entendeu para a pessoa conferir.
 */
export async function readPipelineWorkbook(user: CurrentUser, buffer: Buffer): Promise<PipelineWorkbook> {
  requirePermission(user, RH);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const notes: string[] = [];
  const referenceYear = new Date().getFullYear();

  const positions: ParsedPosition[] = [];
  const pipeline = findSheet(workbook, "Pipeline");
  if (!pipeline) notes.push('Não achei a aba "Pipeline": o plano de sucessão não foi lido.');
  else {
    let headerRow = 0;
    const columns = new Map<string, number>();
    pipeline.eachRow((row, rowNumber) => {
      if (headerRow) return;
      const labels = new Map<string, number>();
      row.eachCell((cell, col) => {
        const t = fold(cellText(cell.value));
        if (t) labels.set(t, col);
      });
      if (labels.has("cargo") && labels.has("area") && labels.has("criticidade")) {
        headerRow = rowNumber;
        for (const [k, v] of labels) columns.set(k, v);
      }
    });
    if (!headerRow) notes.push("Não achei a tabela do plano de sucessão (títulos Cargo, Área, Criticidade).");
    else {
      const at = (row: ExcelJS.Row, key: string) => (columns.has(key) ? cellText(row.getCell(columns.get(key)!).value) : "");
      for (let r = headerRow + 1; r <= pipeline.rowCount; r++) {
        const row = pipeline.getRow(r);
        const cargo = at(row, "cargo");
        if (!cargo) break;
        const due = parseDue(at(row, "prazo"), referenceYear);
        positions.push({
          row: r,
          cargo,
          area: at(row, "area") || null,
          criticality: parseCriticality(at(row, "criticidade")) ?? "MEDIA",
          occupant: at(row, "ocupanteatual") || null,
          successor1: at(row, "sucessor1") || null,
          successor2: at(row, "sucessor2") || null,
          origin: parseOrigin(at(row, "origem")),
          readiness: parseReadiness(at(row, "prontidao")),
          potential: parsePotential(at(row, "potencialsucessor")),
          gap: at(row, "gapsucessor") || null,
          action: at(row, "acao") || null,
          dueDate: due.date ? due.date.toISOString().slice(0, 10) : null,
          dueNote: due.note,
          status: parsePositionStatus(at(row, "status")),
        });
      }
    }
  }

  const cycles: ParsedCycle[] = [];
  const cycleSheet = findSheet(workbook, "Ciclo de Gente");
  if (!cycleSheet) notes.push('Não achei a aba "Ciclo de Gente": nenhum resultado de ciclo foi lido.');
  else {
    const columns = new Map<string, number>();
    cycleSheet.getRow(1).eachCell((cell, col) => {
      const t = fold(cellText(cell.value));
      if (t) columns.set(t, col);
    });
    const col = (...starts: string[]) => {
      for (const [k, v] of columns) if (starts.some((s) => k.startsWith(s))) return v;
      return 0;
    };
    const cName = col("colaborador");
    const cLeader = col("lider");
    const cType = col("tipodeciclo");
    const cIcc = col("icc");
    const cIccRes = col("resultadoicc");
    const cIr = col("ir");
    const cIrRes = col("resultadoir");
    const cSelf = col("resultadoautoavaliacao");
    const cPerf = col("resultadoavaliacao");
    const cFinal = col("classificacaofinal");
    // "ICC (Indicador...)" também começa com "icc"; o resultado tem "resultado" na frente, então a coluna do valor é a que começa com "icc" e não "resultadoicc".
    if (!cName) notes.push('A aba "Ciclo de Gente" não tem a coluna Colaborador.');
    else {
      for (let r = 2; r <= cycleSheet.rowCount; r++) {
        const row = cycleSheet.getRow(r);
        const name = cellText(row.getCell(cName).value);
        if (!name) continue;
        const g = (c: number) => (c ? cellText(row.getCell(c).value) : "");
        cycles.push({
          row: r,
          cycleYear: referenceYear,
          name,
          leader: g(cLeader) || null,
          cycleType: g(cType) || null,
          icc: num(g(cIcc)),
          iccResult: parseIccResult(g(cIccRes)),
          ir: num(g(cIr)),
          irResult: g(cIrRes) || null,
          selfEval: g(cSelf) || null,
          perfEval: g(cPerf) || null,
          finalClass: g(cFinal) || null,
        });
      }
    }
  }
  return { positions, cycles, notes };
}

/** Grava o que a pessoa conferiu. `replacePositions`: troca o plano de sucessão todo pelo da planilha (senão, só acrescenta). O ciclo de gente vai sempre para o ano informado. */
export async function commitPipelineImport(user: CurrentUser, input: { positions: PositionInput[]; cycles: CycleInput[]; replacePositions: boolean; cycleYear: number }) {
  requirePermission(user, RH);
  let positionsSaved = 0;
  let cyclesSaved = 0;
  if (input.positions.length > 0) {
    const prepared = input.positions.map(positionData);
    await db.$transaction(async (tx) => {
      let order = 0;
      if (input.replacePositions) await tx.successionPosition.deleteMany({});
      else order = await tx.successionPosition.count();
      for (const data of prepared) {
        order += 1;
        await tx.successionPosition.create({ data: { ...data, sortOrder: order, updatedById: user.id } });
      }
    });
    positionsSaved = prepared.length;
  }
  if (input.cycles.length > 0) {
    const prepared = input.cycles.map((c) => cycleData({ ...c, cycleYear: input.cycleYear }));
    await db.$transaction(async (tx) => {
      await tx.peopleCycleEntry.deleteMany({ where: { cycleYear: input.cycleYear } });
      await tx.peopleCycleEntry.createMany({ data: prepared.map((d) => ({ ...d, updatedById: user.id })) });
    });
    cyclesSaved = prepared.length;
  }
  await recordAudit({ userId: user.id, action: "CREATE", entityType: "Pipeline", entityId: "import", newValue: { positions: positionsSaved, cycles: cyclesSaved, replace: input.replacePositions } });
  return { positionsSaved, cyclesSaved };
}
