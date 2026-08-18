import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import { createEquipment, updateEquipment } from "@/server/services/equipment.service";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import type { Criticality } from "@/generated/prisma/enums";
import {
  EQUIPMENT_IMPORT_FIELDS,
  type EquipmentImportField,
  type EquipmentImportMapping,
} from "@/domain/equipment/import-fields";
import { parseSpreadsheet, suggestMapping as suggestMappingGeneric, getCell, normalize } from "@/lib/spreadsheet-import";

export type { EquipmentImportField, EquipmentImportMapping };
export { parseSpreadsheet };

const FIELD_ALIASES: Record<EquipmentImportField, string[]> = {
  code: ["codigo", "cod", "tag"],
  name: ["nome", "equipamento", "descricao"],
  assetTag: ["patrimonio", "ativo"],
  equipmentType: ["tipo", "tipoequipamento", "categoria"],
  area: ["area", "local"],
  sector: ["setor"],
  manufacturer: ["fabricante", "marca"],
  model: ["modelo"],
  serialNumber: ["numerodeserie", "numeroserie", "serie", "nserie", "serial"],
  criticality: ["criticidade", "risco"],
  notes: ["observacoes", "observacao", "obs", "notas"],
};

const CRITICALITY_ALIASES: Record<string, Criticality> = {
  baixa: "BAIXA",
  media: "MEDIA",
  alta: "ALTA",
  critica: "CRITICA",
};

function resolveCriticality(raw: string | null, fallback: Criticality): Criticality {
  if (!raw) return fallback;
  return CRITICALITY_ALIASES[normalize(raw)] ?? fallback;
}

/** Gera um código único curto pro Tipo de Equipamento criado automaticamente na importação
 * (o campo é obrigatório no cadastro, mas a planilha só traz o nome). */
function generateTypeCode(name: string, usedCodes: Set<string>): string {
  const base = normalize(name).toUpperCase().slice(0, 30) || "TIPO";
  let code = base;
  let suffix = 2;
  while (usedCodes.has(code)) {
    code = `${base}-${suffix}`;
    suffix++;
  }
  return code;
}

export function suggestMapping(headers: string[]): EquipmentImportMapping {
  return suggestMappingGeneric(
    headers,
    EQUIPMENT_IMPORT_FIELDS.map((f) => f.key),
    FIELD_ALIASES,
  );
}

export type EquipmentImportRowResult = {
  rowIndex: number;
  action: "create" | "update" | "error";
  code: string;
  name: string;
  assetTag: string | null;
  equipmentType: string | null;
  typeId?: string;
  area: string | null;
  areaId?: string;
  unitId?: string;
  sector: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  criticality: Criticality;
  notes: string | null;
  equipmentId?: string;
  error?: string;
};

/** Monta o preview linha a linha: casa por código (igual/maiúsculo). Tipo é criado automaticamente
 * na confirmação se o nome não bater com nenhum já cadastrado (não tem configuração arriscada por
 * trás, só nome + um código gerado). Área continua exigindo cadastro prévio — teria que adivinhar
 * a Unidade certa, e isso também afeta permissão por área, então prefiro deixar a linha pendente a
 * arriscar um vínculo errado. Se a linha já existe (update) e a planilha não traz Tipo/Área/
 * Criticidade pra ela, mantém o que já está cadastrado em vez de apagar. Não escreve nada. */
export async function buildEquipmentImportPreview(
  user: CurrentUser,
  rows: string[][],
  mapping: EquipmentImportMapping,
): Promise<EquipmentImportRowResult[]> {
  requirePermission(user, PERMISSIONS.EQUIPMENT_MANAGE);

  const [types, areas] = await Promise.all([
    db.equipmentType.findMany(),
    db.area.findMany({ where: { active: true }, include: { unit: true } }),
  ]);
  const findType = (name: string | null) =>
    name ? types.find((t) => t.name.trim().toLowerCase() === name.trim().toLowerCase()) : undefined;
  const findArea = (name: string | null) =>
    name ? areas.find((a) => a.name.trim().toLowerCase() === name.trim().toLowerCase()) : undefined;

  const results: EquipmentImportRowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.every((c) => !c || c.trim() === "")) continue;

    const codeRaw = getCell(row, mapping, "code");
    const name = getCell(row, mapping, "name");
    const assetTag = getCell(row, mapping, "assetTag");
    const equipmentTypeRaw = getCell(row, mapping, "equipmentType");
    const areaRaw = getCell(row, mapping, "area");
    const sector = getCell(row, mapping, "sector");
    const manufacturer = getCell(row, mapping, "manufacturer");
    const model = getCell(row, mapping, "model");
    const serialNumber = getCell(row, mapping, "serialNumber");
    const criticalityRaw = getCell(row, mapping, "criticality");
    const notes = getCell(row, mapping, "notes");

    const base = {
      rowIndex: i,
      code: codeRaw ?? "",
      name: name ?? "",
      assetTag,
      equipmentType: equipmentTypeRaw,
      area: areaRaw,
      sector,
      manufacturer,
      model,
      serialNumber,
      notes,
    };

    if (!codeRaw) {
      results.push({ ...base, criticality: "MEDIA", action: "error", error: "Informe o código do equipamento." });
      continue;
    }
    if (!name) {
      results.push({ ...base, criticality: "MEDIA", action: "error", error: "Informe o nome do equipamento." });
      continue;
    }

    const code = codeRaw.toUpperCase();
    const existing = await db.equipment.findUnique({ where: { code } });

    const matchedType = findType(equipmentTypeRaw);
    if (!equipmentTypeRaw && !existing) {
      results.push({ ...base, code, criticality: "MEDIA", action: "error", error: "Informe o tipo do equipamento." });
      continue;
    }

    const matchedArea = findArea(areaRaw);
    if (areaRaw && !matchedArea) {
      results.push({
        ...base,
        code,
        criticality: existing?.criticality ?? "MEDIA",
        action: "error",
        error: `Área "${areaRaw}" não cadastrada. Cadastre em Cadastros > Áreas e Unidades antes de reimportar.`,
      });
      continue;
    }
    if (!areaRaw && !existing) {
      results.push({ ...base, code, criticality: "MEDIA", action: "error", error: "Informe a área do equipamento." });
      continue;
    }

    results.push({
      ...base,
      code,
      typeId: matchedType?.id ?? existing?.typeId,
      areaId: matchedArea?.id ?? existing?.areaId,
      unitId: matchedArea?.unitId ?? existing?.unitId,
      criticality: resolveCriticality(criticalityRaw, existing?.criticality ?? "MEDIA"),
      action: existing ? "update" : "create",
      equipmentId: existing?.id,
    });
  }

  return results;
}

/** Aplica as linhas revisadas reaproveitando `createEquipment`/`updateEquipment` (não escreve
 * direto no banco) — diferente do import de RH, aqui não há efeito colateral indesejado a evitar:
 * o histórico de área e o evento "cadastrado via importação" no timeline do equipamento são
 * exatamente o que se espera de um cadastro em lote. */
export async function commitEquipmentImport(
  user: CurrentUser,
  rows: EquipmentImportRowResult[],
): Promise<{ created: number; updated: number; errors: number }> {
  requirePermission(user, PERMISSIONS.EQUIPMENT_MANAGE);

  const existingTypes = await db.equipmentType.findMany();
  const typeIdByName = new Map(existingTypes.map((t) => [t.name.trim().toLowerCase(), t.id]));
  const usedCodes = new Set(existingTypes.map((t) => t.code));

  async function resolveOrCreateTypeId(name: string): Promise<string> {
    const key = name.trim().toLowerCase();
    const cached = typeIdByName.get(key);
    if (cached) return cached;
    const code = generateTypeCode(name, usedCodes);
    usedCodes.add(code);
    const created = await db.equipmentType.create({ data: { name: name.trim(), code } });
    typeIdByName.set(key, created.id);
    return created.id;
  }

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const row of rows) {
    if (row.action === "error" || !row.areaId || !row.unitId) {
      errors++;
      continue;
    }
    try {
      const typeId = row.typeId ?? (row.equipmentType ? await resolveOrCreateTypeId(row.equipmentType) : undefined);
      if (!typeId) {
        errors++;
        continue;
      }
      const data = {
        code: row.code,
        name: row.name,
        assetTag: row.assetTag,
        typeId,
        manufacturer: row.manufacturer,
        model: row.model,
        serialNumber: row.serialNumber,
        unitId: row.unitId,
        areaId: row.areaId,
        sector: row.sector,
        criticality: row.criticality,
        notes: row.notes,
      };
      if (row.action === "update" && row.equipmentId) {
        await updateEquipment(user, row.equipmentId, data);
        updated++;
      } else {
        await createEquipment(user, data);
        created++;
      }
    } catch (error) {
      console.error(`[equipment-import] falha ao importar linha ${row.rowIndex}:`, error);
      errors++;
    }
  }

  await recordAudit({
    userId: user.id,
    action: "CREATE",
    entityType: "EquipmentImport",
    entityId: crypto.randomUUID(),
    newValue: { created, updated, errors, total: rows.length },
  });

  return { created, updated, errors };
}
