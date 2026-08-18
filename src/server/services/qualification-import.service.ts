import "server-only";
import { addMonths, endOfDay, startOfDay } from "date-fns";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import {
  QUALIFICATION_IMPORT_FIELDS,
  type QualificationImportField,
  type QualificationImportMapping,
} from "@/domain/qualification/import-fields";
import { parseSpreadsheet, suggestMapping as suggestMappingGeneric, getCell, parseDateCell } from "@/lib/spreadsheet-import";

export type { QualificationImportField, QualificationImportMapping };
export { parseSpreadsheet };

const FIELD_ALIASES: Record<QualificationImportField, string[]> = {
  matricula: ["matricula", "registro", "codigo"],
  cpf: ["cpf"],
  name: ["nome", "colaborador", "funcionario"],
  qualificationType: ["tipo", "qualificacao", "treinamento", "nr", "aso"],
  completedDate: ["dataconclusao", "conclusao", "data", "realizacao", "datarealizacao"],
  notes: ["observacoes", "observacao", "obs", "notas"],
};

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
  qualificationType: string | null;
  qualificationTypeId?: string;
  completedDate: string | null;
  notes: string | null;
  collaboratorId?: string;
  error?: string;
};

/** Monta o preview linha a linha: casa colaborador por matrícula/CPF e tipo por nome (contra tipos já
 * cadastrados em Cadastros > Qualificações — não cria tipo novo, porque criar um tipo sem saber a
 * validade certa (meses) faria a ficha achar que o ASO/NR não vence, um risco de segurança maior
 * do que simplesmente deixar a linha pendente pro usuário cadastrar o tipo certo antes). Também
 * marca como "duplicate" quando já existe um registro idêntico (mesmo colaborador/tipo/dia), pra
 * reimportar a mesma planilha não duplicar histórico. Não escreve nada. */
export async function buildQualificationImportPreview(
  user: CurrentUser,
  rows: string[][],
  mapping: QualificationImportMapping,
): Promise<QualificationImportRowResult[]> {
  requirePermission(user, PERMISSIONS.QUALIFICATION_MANAGE);

  const types = await db.qualificationType.findMany({ where: { active: true } });
  const findTypeId = (name: string | null) =>
    name ? types.find((t) => t.name.trim().toLowerCase() === name.trim().toLowerCase())?.id : undefined;

  const results: QualificationImportRowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.every((c) => !c || c.trim() === "")) continue;

    const matricula = getCell(row, mapping, "matricula");
    const cpf = getCell(row, mapping, "cpf");
    const name = getCell(row, mapping, "name");
    const qualificationType = getCell(row, mapping, "qualificationType");
    const completedDateRaw = getCell(row, mapping, "completedDate");
    const notes = getCell(row, mapping, "notes");
    const completedDate = parseDateCell(completedDateRaw);
    const qualificationTypeId = findTypeId(qualificationType);

    const base = {
      rowIndex: i,
      name,
      matricula,
      cpf,
      qualificationType,
      qualificationTypeId,
      completedDate: completedDate ? completedDate.toISOString().slice(0, 10) : null,
      notes,
    };

    if (!matricula && !cpf) {
      results.push({ ...base, action: "error", error: "Informe matrícula ou CPF pra identificar o colaborador." });
      continue;
    }

    let collaborator = matricula ? await db.collaborator.findUnique({ where: { matricula } }) : null;
    if (!collaborator && cpf) collaborator = await db.collaborator.findFirst({ where: { cpf } });
    if (!collaborator) {
      results.push({ ...base, action: "error", error: "Colaborador não encontrado para essa matrícula/CPF." });
      continue;
    }

    if (!qualificationType) {
      results.push({ ...base, action: "error", error: "Informe o tipo (NR/ASO/Integração)." });
      continue;
    }
    if (!qualificationTypeId) {
      results.push({
        ...base,
        action: "error",
        error: `Tipo "${qualificationType}" não cadastrado. Cadastre em Cadastros > Tipos de Qualificação antes de reimportar.`,
      });
      continue;
    }

    if (!completedDate) {
      results.push({ ...base, action: "error", error: "Data de conclusão ausente ou inválida." });
      continue;
    }

    const duplicate = await db.qualificationRecord.findFirst({
      where: {
        collaboratorId: collaborator.id,
        qualificationTypeId,
        completedDate: { gte: startOfDay(completedDate), lte: endOfDay(completedDate) },
      },
    });

    results.push({
      ...base,
      action: duplicate ? "duplicate" : "create",
      collaboratorId: collaborator.id,
    });
  }

  return results;
}

/** Aplica as linhas revisadas, linha a linha. "duplicate" é ignorada (idempotente numa reimportação),
 * "error" não é escrita — só "create" grava, com expiresAt calculado a partir da validade do tipo. */
export async function commitQualificationImport(
  user: CurrentUser,
  rows: QualificationImportRowResult[],
): Promise<{ created: number; duplicates: number; errors: number }> {
  requirePermission(user, PERMISSIONS.QUALIFICATION_MANAGE);

  const types = await db.qualificationType.findMany();
  const validityByTypeId = new Map(types.map((t) => [t.id, t.validityMonths]));

  let created = 0;
  let duplicates = 0;
  let errors = 0;

  for (const row of rows) {
    if (row.action === "error") {
      errors++;
      continue;
    }
    if (row.action === "duplicate" || !row.collaboratorId || !row.qualificationTypeId || !row.completedDate) {
      duplicates++;
      continue;
    }
    try {
      const completedDate = new Date(`${row.completedDate}T12:00:00`);

      const stillDuplicate = await db.qualificationRecord.findFirst({
        where: {
          collaboratorId: row.collaboratorId,
          qualificationTypeId: row.qualificationTypeId,
          completedDate: { gte: startOfDay(completedDate), lte: endOfDay(completedDate) },
        },
      });
      if (stillDuplicate) {
        duplicates++;
        continue;
      }

      const validityMonths = validityByTypeId.get(row.qualificationTypeId) ?? null;
      const expiresAt = validityMonths ? addMonths(completedDate, validityMonths) : null;

      await db.qualificationRecord.create({
        data: {
          collaboratorId: row.collaboratorId,
          qualificationTypeId: row.qualificationTypeId,
          completedDate,
          expiresAt,
          notes: row.notes ?? null,
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
