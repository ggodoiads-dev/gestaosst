import "server-only";
import { addMonths, endOfDay, startOfDay } from "date-fns";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import type { QualificationCategory } from "@/generated/prisma/enums";
import {
  QUALIFICATION_IMPORT_FIELDS,
  type QualificationImportField,
  type QualificationImportMapping,
} from "@/domain/qualification/import-fields";
import { parseSpreadsheet, suggestMapping as suggestMappingGeneric, getCell, parseDateCell, normalize } from "@/lib/spreadsheet-import";

export type { QualificationImportField, QualificationImportMapping };
export { parseSpreadsheet };

const FIELD_ALIASES: Record<QualificationImportField, string[]> = {
  matricula: ["matricula", "registro", "codigo"],
  cpf: ["cpf"],
  name: ["colaborador", "nome", "funcionario"],
  category: ["categoria"],
  qualificationType: ["treinamento", "tipo", "qualificacao", "curso"],
  completedDate: ["datarealizacao", "realizacao", "datadeconclusao", "conclusao"],
  validityMonths: ["validadeemmeses", "validademeses", "validade"],
  nrNumber: ["nr"],
  workload: ["cargahoraria", "carga", "horas"],
  location: ["local"],
  instructor: ["instrutor", "palestrante"],
  notes: ["observacoes", "observacao", "obs", "notas"],
};

const CATEGORY_ALIASES: Record<string, QualificationCategory> = {
  nr: "NR",
  aso: "ASO",
  integracao: "INTEGRACAO",
  outro: "OUTRO",
};

function resolveCategory(raw: string | null): QualificationCategory | undefined {
  return raw ? CATEGORY_ALIASES[normalize(raw)] : undefined;
}

function parseIntCell(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function buildNotes(row: {
  notes: string | null;
  nrNumber: string | null;
  workload: string | null;
  location: string | null;
  instructor: string | null;
}): string | null {
  const parts: string[] = [];
  if (row.notes) parts.push(row.notes);
  if (row.nrNumber) parts.push(`NR: ${row.nrNumber}`);
  if (row.workload) parts.push(`Carga horária: ${row.workload}`);
  if (row.location) parts.push(`Local: ${row.location}`);
  if (row.instructor) parts.push(`Instrutor: ${row.instructor}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function suggestMapping(headers: string[]): QualificationImportMapping {
  return suggestMappingGeneric(
    headers,
    QUALIFICATION_IMPORT_FIELDS.map((f) => f.key),
    FIELD_ALIASES,
  );
}

export type QualificationImportRowResult = {
  rowIndex: number;
  action: "create" | "duplicate" | "error";
  name: string | null;
  matricula: string | null;
  cpf: string | null;
  category: string | null;
  categoryValue?: QualificationCategory;
  qualificationType: string | null;
  qualificationTypeId?: string;
  completedDate: string | null;
  validityMonths: number | null;
  nrNumber: string | null;
  workload: string | null;
  location: string | null;
  instructor: string | null;
  notes: string | null;
  collaboratorId?: string;
  error?: string;
};

/** Monta o preview linha a linha. Colaborador: casa por matrícula/CPF se informados, senão pelo
 * nome exato (se mais de um colaborador tiver o mesmo nome, marca erro pedindo pra desambiguar
 * com matrícula/CPF nessa linha). Treinamento: casa por nome contra os tipos já cadastrados; se
 * não existir ainda, é criado na confirmação usando a Categoria e a Validade em meses da própria
 * planilha (diferente da 1ª versão, que exigia cadastrar o tipo manualmente antes — agora a
 * planilha já traz a validade, então criar automaticamente não tem mais o risco de "parecer que
 * nunca vence"). Marca "duplicate" quando já existe um registro idêntico (mesmo colaborador+tipo+
 * dia), pra reimportar a mesma planilha não duplicar histórico. Não escreve nada. */
export async function buildQualificationImportPreview(
  user: CurrentUser,
  rows: string[][],
  mapping: QualificationImportMapping,
): Promise<QualificationImportRowResult[]> {
  requirePermission(user, PERMISSIONS.QUALIFICATION_MANAGE);

  const types = await db.qualificationType.findMany({ where: { active: true } });
  // normalize() já tira acento/espaço/hífen — assim "NR-11", "NR 11" e "NR11" batem entre si, e
  // um sinônimo cadastrado tipo "Operador de Empilhadeira" também casa direto com o tipo
  // canônico "NR-11" sem precisar bater a string exata.
  const findType = (name: string | null) => {
    if (!name) return undefined;
    const target = normalize(name);
    return types.find((t) => normalize(t.name) === target || t.aliases.some((alias) => normalize(alias) === target));
  };

  const results: QualificationImportRowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.every((c) => !c || c.trim() === "")) continue;

    const matricula = getCell(row, mapping, "matricula");
    const cpf = getCell(row, mapping, "cpf");
    const name = getCell(row, mapping, "name");
    const categoryRaw = getCell(row, mapping, "category");
    const qualificationType = getCell(row, mapping, "qualificationType");
    const completedDateRaw = getCell(row, mapping, "completedDate");
    const validityMonths = parseIntCell(getCell(row, mapping, "validityMonths"));
    const nrNumber = getCell(row, mapping, "nrNumber");
    const workload = getCell(row, mapping, "workload");
    const location = getCell(row, mapping, "location");
    const instructor = getCell(row, mapping, "instructor");
    const notes = getCell(row, mapping, "notes");
    const completedDate = parseDateCell(completedDateRaw);
    const matchedType = findType(qualificationType);
    const categoryValue = resolveCategory(categoryRaw);

    const base = {
      rowIndex: i,
      name,
      matricula,
      cpf,
      category: categoryRaw,
      categoryValue,
      qualificationType,
      qualificationTypeId: matchedType?.id,
      completedDate: completedDate ? completedDate.toISOString().slice(0, 10) : null,
      validityMonths,
      nrNumber,
      workload,
      location,
      instructor,
      notes,
    };

    if (!qualificationType) {
      results.push({ ...base, action: "error", error: "Informe o treinamento." });
      continue;
    }
    if (!completedDate) {
      results.push({ ...base, action: "error", error: "Data de realização ausente ou inválida." });
      continue;
    }
    if (!matchedType && !categoryValue) {
      results.push({
        ...base,
        action: "error",
        error: `Treinamento "${qualificationType}" ainda não cadastrado. Informe a Categoria (NR/ASO/Integração/Outro) nessa linha pra cadastrar automaticamente.`,
      });
      continue;
    }

    if (!matricula && !cpf && !name) {
      results.push({ ...base, action: "error", error: "Informe o colaborador (nome, matrícula ou CPF)." });
      continue;
    }

    let collaborator = matricula ? await db.collaborator.findUnique({ where: { matricula } }) : null;
    if (!collaborator && cpf) collaborator = await db.collaborator.findFirst({ where: { cpf } });
    if (!collaborator && name) {
      const matches = await db.collaborator.findMany({ where: { name: { equals: name, mode: "insensitive" } } });
      if (matches.length === 1) {
        collaborator = matches[0];
      } else if (matches.length > 1) {
        results.push({
          ...base,
          action: "error",
          error: `Mais de um colaborador chamado "${name}". Informe matrícula ou CPF nessa linha pra identificar.`,
        });
        continue;
      }
    }
    if (!collaborator) {
      results.push({ ...base, action: "error", error: "Colaborador não encontrado." });
      continue;
    }

    let action: "create" | "duplicate" = "create";
    if (matchedType) {
      const duplicate = await db.qualificationRecord.findFirst({
        where: {
          collaboratorId: collaborator.id,
          qualificationTypeId: matchedType.id,
          completedDate: { gte: startOfDay(completedDate), lte: endOfDay(completedDate) },
        },
      });
      if (duplicate) action = "duplicate";
    }

    results.push({ ...base, action, collaboratorId: collaborator.id });
  }

  return results;
}

/** Aplica as linhas revisadas. "duplicate" é ignorada (idempotente numa reimportação), "error"
 * não é escrita — só "create" grava, criando o tipo de qualificação se ainda não existir (usando
 * a categoria/validade da própria linha) e calculando o vencimento a partir da validade do tipo
 * (já existente ou recém-criado). */
export async function commitQualificationImport(
  user: CurrentUser,
  rows: QualificationImportRowResult[],
): Promise<{ created: number; duplicates: number; errors: number }> {
  requirePermission(user, PERMISSIONS.QUALIFICATION_MANAGE);

  const existingTypes = await db.qualificationType.findMany();
  const typeCache = new Map(
    existingTypes.map((t) => [t.name.trim().toLowerCase(), { id: t.id, validityMonths: t.validityMonths }]),
  );

  async function resolveOrCreateType(name: string, category: QualificationCategory, validityMonths: number | null) {
    const key = name.trim().toLowerCase();
    const cached = typeCache.get(key);
    if (cached) return cached;
    const created = await db.qualificationType.create({ data: { name: name.trim(), category, validityMonths } });
    const entry = { id: created.id, validityMonths: created.validityMonths };
    typeCache.set(key, entry);
    return entry;
  }

  let created = 0;
  let duplicates = 0;
  let errors = 0;

  for (const row of rows) {
    if (row.action === "error") {
      errors++;
      continue;
    }
    if (row.action === "duplicate" || !row.collaboratorId || !row.completedDate || !row.qualificationType) {
      duplicates++;
      continue;
    }
    try {
      const completedDate = new Date(`${row.completedDate}T12:00:00`);
      const type = await resolveOrCreateType(row.qualificationType, row.categoryValue ?? "OUTRO", row.validityMonths);

      const stillDuplicate = await db.qualificationRecord.findFirst({
        where: {
          collaboratorId: row.collaboratorId,
          qualificationTypeId: type.id,
          completedDate: { gte: startOfDay(completedDate), lte: endOfDay(completedDate) },
        },
      });
      if (stillDuplicate) {
        duplicates++;
        continue;
      }

      const expiresAt = type.validityMonths ? addMonths(completedDate, type.validityMonths) : null;

      await db.qualificationRecord.create({
        data: {
          collaboratorId: row.collaboratorId,
          qualificationTypeId: type.id,
          completedDate,
          expiresAt,
          notes: buildNotes(row),
          createdById: user.id,
        },
      });
      created++;
    } catch (error) {
      console.error(`[qualification-import] falha ao importar linha ${row.rowIndex}:`, error);
      errors++;
    }
  }

  await recordAudit({
    userId: user.id,
    action: "CREATE",
    entityType: "QualificationImport",
    entityId: crypto.randomUUID(),
    newValue: { created, duplicates, errors, total: rows.length },
  });

  return { created, duplicates, errors };
}
