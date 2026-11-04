import "server-only";
import ExcelJS from "exceljs";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { matrixStats, parseLevel, SPECIALIST_GROUPS } from "@/domain/pipeline/matrix";
import { POSITION_STATUS, parseDue, parsePositionStatus } from "@/domain/pipeline/rules";

const RH = PERMISSIONS.HR_MANAGE;

const str = (v: unknown, max = 300): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, max) : null);

// ── Matriz de função ──

export type MatrixView = {
  ready: boolean;
  matrices: { id: string; name: string }[];
  current: {
    id: string;
    name: string;
    skills: { id: string; name: string }[];
    members: { id: string; name: string; role: string | null; grp: string | null; collaboratorId: string | null; levels: Record<string, number> }[];
    stats: ReturnType<typeof matrixStats>;
  } | null;
  collaborators: { id: string; name: string; functionName: string | null }[];
};

/** Matrizes e a escolhida (ou a primeira) com as atividades, as pessoas, os níveis e as estatísticas. Tolerante: sem as tabelas, devolve `ready: false`. */
export async function getMatrixView(user: CurrentUser, matrixId?: string): Promise<MatrixView> {
  requirePermission(user, RH);
  const collaborators = (await db.collaborator.findMany({ where: { active: true }, select: { id: true, name: true, function: { select: { name: true } } }, orderBy: { name: "asc" } })).map((c) => ({
    id: c.id,
    name: c.name,
    functionName: c.function?.name ?? null,
  }));
  try {
    const matrices = await db.skillMatrix.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, name: true } });
    const chosen = matrices.find((m) => m.id === matrixId) ?? matrices[0];
    if (!chosen) return { ready: true, matrices, current: null, collaborators };
    const full = await db.skillMatrix.findUniqueOrThrow({
      where: { id: chosen.id },
      include: { skills: { orderBy: { sortOrder: "asc" } }, members: { orderBy: { sortOrder: "asc" }, include: { levels: true } } },
    });
    const members = full.members.map((m) => ({
      id: m.id,
      name: m.name,
      role: m.role,
      grp: m.grp,
      collaboratorId: m.collaboratorId,
      levels: Object.fromEntries(m.levels.map((l) => [l.skillId, l.level])),
    }));
    const skills = full.skills.map((s) => ({ id: s.id, name: s.name }));
    return { ready: true, matrices, current: { id: full.id, name: full.name, skills, members, stats: matrixStats(skills.map((s) => s.id), members.map((m) => ({ id: m.id, levels: m.levels }))) }, collaborators };
  } catch (error) {
    console.error("[matriz] tabelas indisponíveis:", error);
    return { ready: false, matrices: [], current: null, collaborators };
  }
}

export async function createMatrix(user: CurrentUser, name: string, skills: string[] = []) {
  requirePermission(user, RH);
  const clean = str(name, 120);
  if (!clean) throw new Error("Informe o nome da matriz.");
  const order = await db.skillMatrix.count();
  const created = await db.skillMatrix.create({
    data: { name: clean, sortOrder: order + 1, skills: { create: skills.map((s) => str(s, 120)).filter((s): s is string => !!s).map((s, i) => ({ name: s, sortOrder: i + 1 })) } },
  });
  await recordAudit({ userId: user.id, action: "CREATE", entityType: "SkillMatrix", entityId: created.id, newValue: { name: clean } });
  return created.id;
}

export async function renameMatrix(user: CurrentUser, id: string, name: string) {
  requirePermission(user, RH);
  const clean = str(name, 120);
  if (!clean) throw new Error("Informe o nome da matriz.");
  await db.skillMatrix.update({ where: { id }, data: { name: clean } });
}

export async function deleteMatrix(user: CurrentUser, id: string) {
  requirePermission(user, RH);
  const before = await db.skillMatrix.findUniqueOrThrow({ where: { id } });
  await db.skillMatrix.delete({ where: { id } });
  await recordAudit({ userId: user.id, action: "DELETE", entityType: "SkillMatrix", entityId: id, previousValue: { name: before.name } });
}

export async function addSkill(user: CurrentUser, matrixId: string, name: string) {
  requirePermission(user, RH);
  const clean = str(name, 120);
  if (!clean) throw new Error("Informe o nome da atividade.");
  const order = await db.skillMatrixSkill.count({ where: { matrixId } });
  await db.skillMatrixSkill.create({ data: { matrixId, name: clean, sortOrder: order + 1 } });
}

export async function deleteSkill(user: CurrentUser, skillId: string) {
  requirePermission(user, RH);
  await db.skillMatrixSkill.delete({ where: { id: skillId } });
}

export async function addMember(user: CurrentUser, matrixId: string, input: { collaboratorId?: string | null; name: string; role?: string | null; grp?: string | null }) {
  requirePermission(user, RH);
  const name = str(input.name, 160);
  if (!name) throw new Error("Informe o nome da pessoa.");
  const order = await db.skillMatrixMember.count({ where: { matrixId } });
  await db.skillMatrixMember.create({ data: { matrixId, collaboratorId: input.collaboratorId || null, name, role: str(input.role, 120), grp: str(input.grp, 80), sortOrder: order + 1 } });
}

/**
 * Coloca na matriz todos os colaboradores ativos de uma função (os que ainda não estão nela). O grupo vem do cadastro: quem tem a trilha de Padrinho
 * entra como "Padrinho"; os demais, como "Operacional". Os níveis ficam em branco para serem avaliados.
 */
export async function addMembersByFunction(user: CurrentUser, matrixId: string, functionName: string) {
  requirePermission(user, RH);
  const wanted = fold(functionName);
  if (!wanted) throw new Error("Escolha a função.");
  const [people, existing] = await Promise.all([
    db.collaborator.findMany({ where: { active: true, functionId: { not: null } }, select: { id: true, name: true, function: { select: { name: true } } }, orderBy: { name: "asc" } }),
    db.skillMatrixMember.findMany({ where: { matrixId }, select: { collaboratorId: true } }),
  ]);
  const already = new Set(existing.map((m) => m.collaboratorId).filter((x): x is string => !!x));
  const chosen = people.filter((p) => p.function && fold(p.function.name) === wanted && !already.has(p.id));
  if (chosen.length === 0) return 0;
  const padrinhos = await db.qualificationRecord.findMany({ where: { collaboratorId: { in: chosen.map((p) => p.id) }, qualificationType: { name: { contains: "padrinho", mode: "insensitive" } } }, select: { collaboratorId: true } });
  const isPadrinho = new Set(padrinhos.map((r) => r.collaboratorId));
  let order = await db.skillMatrixMember.count({ where: { matrixId } });
  await db.skillMatrixMember.createMany({
    data: chosen.map((p) => ({ matrixId, collaboratorId: p.id, name: p.name, role: p.function!.name, grp: isPadrinho.has(p.id) ? "Padrinho" : "Operacional", sortOrder: ++order })),
  });
  await recordAudit({ userId: user.id, action: "UPDATE", entityType: "SkillMatrix", entityId: matrixId, newValue: { addedByFunction: functionName, count: chosen.length } });
  return chosen.length;
}

/** Aplica o mesmo nível a todas as atividades da pessoa (atalho para preencher a linha; depois se ajusta célula a célula). */
export async function setRowLevel(user: CurrentUser, memberId: string, level: number) {
  requirePermission(user, RH);
  if (!Number.isInteger(level) || level < 0 || level > 4) throw new Error("Nível inválido.");
  const member = await db.skillMatrixMember.findUniqueOrThrow({ where: { id: memberId }, select: { matrix: { select: { skills: { select: { id: true } } } } } });
  await db.$transaction(
    member.matrix.skills.map((s) => db.skillMatrixLevel.upsert({ where: { memberId_skillId: { memberId, skillId: s.id } }, update: { level }, create: { memberId, skillId: s.id, level } })),
  );
}

export async function updateMember(user: CurrentUser, memberId: string, input: { role?: string | null; grp?: string | null }) {
  requirePermission(user, RH);
  await db.skillMatrixMember.update({ where: { id: memberId }, data: { role: str(input.role, 120), grp: str(input.grp, 80) } });
}

export async function deleteMember(user: CurrentUser, memberId: string) {
  requirePermission(user, RH);
  await db.skillMatrixMember.delete({ where: { id: memberId } });
}

/** Define o nível de uma pessoa numa atividade; `null` desfaz a avaliação (a célula volta a "não avaliado"). */
export async function setLevel(user: CurrentUser, memberId: string, skillId: string, level: number | null) {
  requirePermission(user, RH);
  if (level === null) {
    await db.skillMatrixLevel.deleteMany({ where: { memberId, skillId } });
    return;
  }
  if (!Number.isInteger(level) || level < 0 || level > 4) throw new Error("Nível inválido.");
  await db.skillMatrixLevel.upsert({ where: { memberId_skillId: { memberId, skillId } }, update: { level }, create: { memberId, skillId, level } });
}

// ── Especialistas de função ──

export type SpecialistRow = {
  id: string;
  name: string;
  functionName: string | null;
  grp: string;
  skill: string | null;
  action: string | null;
  dueDate: Date | null;
  dueNote: string | null;
  follow: string | null;
  status: string | null;
};

export type SpecialistInput = {
  name: string;
  functionName?: string | null;
  grp: string;
  skill?: string | null;
  action?: string | null;
  dueDate?: string | null;
  dueNote?: string | null;
  follow?: string | null;
  status?: string | null;
};

export async function listSpecialists(user: CurrentUser): Promise<{ ready: boolean; rows: SpecialistRow[] }> {
  requirePermission(user, RH);
  try {
    const rows = await db.functionSpecialist.findMany({ orderBy: [{ grp: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] });
    return { ready: true, rows: rows.map((r) => ({ id: r.id, name: r.name, functionName: r.functionName, grp: r.grp, skill: r.skill, action: r.action, dueDate: r.dueDate, dueNote: r.dueNote, follow: r.follow, status: r.status })) };
  } catch (error) {
    console.error("[especialistas] tabela indisponível:", error);
    return { ready: false, rows: [] };
  }
}

function specialistData(input: SpecialistInput) {
  const name = str(input.name, 160);
  if (!name) throw new Error("Informe o nome da pessoa.");
  const grp = str(input.grp, 80);
  if (!grp) throw new Error("Escolha o grupo.");
  const due = input.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) ? new Date(`${input.dueDate}T12:00:00Z`) : null;
  return {
    name,
    functionName: str(input.functionName, 120),
    grp,
    skill: str(input.skill, 160),
    action: str(input.action, 600),
    dueDate: due,
    dueNote: str(input.dueNote, 120),
    follow: str(input.follow, 300),
    status: input.status && POSITION_STATUS.some((s) => s.key === input.status) ? input.status : null,
  };
}

export async function saveSpecialist(user: CurrentUser, id: string | null, input: SpecialistInput) {
  requirePermission(user, RH);
  const data = { ...specialistData(input), updatedById: user.id };
  const saved = id ? await db.functionSpecialist.update({ where: { id }, data }) : await db.functionSpecialist.create({ data: { ...data, sortOrder: (await db.functionSpecialist.count()) + 1 } });
  await recordAudit({ userId: user.id, action: id ? "UPDATE" : "CREATE", entityType: "FunctionSpecialist", entityId: saved.id, newValue: { name: data.name, grp: data.grp } });
}

export async function deleteSpecialist(user: CurrentUser, id: string) {
  requirePermission(user, RH);
  const before = await db.functionSpecialist.findUniqueOrThrow({ where: { id } });
  await db.functionSpecialist.delete({ where: { id } });
  await recordAudit({ userId: user.id, action: "DELETE", entityType: "FunctionSpecialist", entityId: id, previousValue: { name: before.name } });
}

// ── Importação da planilha ──

export type ParsedMatrix = { name: string; skills: string[]; members: { name: string; role: string | null; grp: string | null; levels: (number | null)[] }[] };
export type ParsedSpecialist = SpecialistInput & { row: number };
export type MatrixWorkbook = { matrices: ParsedMatrix[]; specialists: ParsedSpecialist[]; notes: string[] };

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

/**
 * Lê da planilha de gestão do pipeline a Matriz de função (cada bloco com títulos Nome, Função, Grupo e as atividades em seguida, até "Aderência") e o plano
 * dos Especialistas de função (títulos Nome, Função, Grupo, Habilidade, Ação, Data, Follow, Status). Não grava nada.
 */
export async function readMatrixWorkbook(user: CurrentUser, buffer: Buffer): Promise<MatrixWorkbook> {
  requirePermission(user, RH);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const notes: string[] = [];
  const referenceYear = new Date().getFullYear();

  const matrices: ParsedMatrix[] = [];
  const matrixSheet = workbook.worksheets.find((w) => fold(w.name).includes("matriz"));
  if (!matrixSheet) notes.push('Não achei a aba "Matriz função".');
  else {
    for (let r = 1; r <= matrixSheet.rowCount; r++) {
      const row = matrixSheet.getRow(r);
      if (fold(cellText(row.getCell(2).value)) !== "nome" || fold(cellText(row.getCell(3).value)) !== "funcao") continue;
      const skills: string[] = [];
      for (let c = 5; c <= matrixSheet.columnCount; c++) {
        const t = cellText(row.getCell(c).value);
        if (!t || fold(t) === "aderencia") break;
        skills.push(t);
      }
      const title = cellText(matrixSheet.getRow(Math.max(r - 2, 1)).getCell(2).value) || `Matriz ${matrices.length + 1}`;
      const members: ParsedMatrix["members"] = [];
      for (let m = r + 1; m <= matrixSheet.rowCount; m++) {
        const mr = matrixSheet.getRow(m);
        const name = cellText(mr.getCell(2).value);
        if (!name) break;
        members.push({ name, role: cellText(mr.getCell(3).value) || null, grp: cellText(mr.getCell(4).value) || null, levels: skills.map((_, i) => parseLevel(cellText(mr.getCell(5 + i).value))) });
      }
      matrices.push({ name: title, skills, members });
    }
    if (matrices.length === 0) notes.push("Não achei nenhuma matriz (títulos Nome e Função).");
  }

  const specialists: ParsedSpecialist[] = [];
  const specSheet = workbook.worksheets.find((w) => fold(w.name).includes("especialistas"));
  if (specSheet) {
    let header = 0;
    const cols = new Map<string, number>();
    for (let r = 1; r <= Math.min(specSheet.rowCount, 30) && !header; r++) {
      const row = specSheet.getRow(r);
      const labels = new Map<string, number>();
      row.eachCell((cell, col) => {
        const t = fold(cellText(cell.value));
        if (t) labels.set(t, col);
      });
      if (labels.has("nome") && labels.has("habilidade")) {
        header = r;
        for (const [k, v] of labels) cols.set(k, v);
      }
    }
    if (header) {
      const at = (row: ExcelJS.Row, key: string) => (cols.has(key) ? cellText(row.getCell(cols.get(key)!).value) : "");
      for (let r = header + 1; r <= specSheet.rowCount; r++) {
        const row = specSheet.getRow(r);
        const name = at(row, "nome");
        if (!name) continue;
        const due = parseDue(at(row, "data"), referenceYear);
        specialists.push({
          row: r,
          name,
          functionName: at(row, "funcao") || null,
          grp: at(row, "grupo") || SPECIALIST_GROUPS[0],
          skill: at(row, "habilidade") || null,
          action: at(row, "acao") || null,
          dueDate: due.date ? due.date.toISOString().slice(0, 10) : null,
          dueNote: due.note,
          follow: at(row, "follow") || null,
          status: parsePositionStatus(at(row, "status")),
        });
      }
    }
  }
  return { matrices, specialists, notes };
}

/** Grava o que foi conferido. `replaceMatrices`: apaga as matrizes de hoje antes; senão, acrescenta. */
export async function commitMatrixImport(user: CurrentUser, input: { matrices: ParsedMatrix[]; specialists: SpecialistInput[]; replaceMatrices: boolean }) {
  requirePermission(user, RH);
  let matricesSaved = 0;
  let membersSaved = 0;
  let specialistsSaved = 0;
  if (input.matrices.length > 0) {
    await db.$transaction(async (tx) => {
      if (input.replaceMatrices) await tx.skillMatrix.deleteMany({});
      let order = await tx.skillMatrix.count();
      for (const m of input.matrices) {
        const name = str(m.name, 120);
        if (!name) continue;
        order += 1;
        const skills = m.skills.map((s) => str(s, 120)).filter((s): s is string => !!s);
        const matrix = await tx.skillMatrix.create({ data: { name, sortOrder: order } });
        const skillRows = await Promise.all(skills.map((s, i) => tx.skillMatrixSkill.create({ data: { matrixId: matrix.id, name: s, sortOrder: i + 1 } })));
        let memberOrder = 0;
        for (const member of m.members) {
          const memberName = str(member.name, 160);
          if (!memberName) continue;
          memberOrder += 1;
          const created = await tx.skillMatrixMember.create({ data: { matrixId: matrix.id, name: memberName, role: str(member.role, 120), grp: str(member.grp, 80), sortOrder: memberOrder } });
          const levels = member.levels.map((level, i) => ({ level, skill: skillRows[i] })).filter((x): x is { level: number; skill: (typeof skillRows)[number] } => typeof x.level === "number" && !!x.skill);
          if (levels.length > 0) await tx.skillMatrixLevel.createMany({ data: levels.map((x) => ({ memberId: created.id, skillId: x.skill.id, level: x.level })) });
          membersSaved += 1;
        }
        matricesSaved += 1;
      }
    });
  }
  for (const s of input.specialists) {
    await saveSpecialist(user, null, s);
    specialistsSaved += 1;
  }
  await recordAudit({ userId: user.id, action: "CREATE", entityType: "SkillMatrix", entityId: "import", newValue: { matrices: matricesSaved, members: membersSaved, specialists: specialistsSaved, replace: input.replaceMatrices } });
  return { matricesSaved, membersSaved, specialistsSaved };
}
