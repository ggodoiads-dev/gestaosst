import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import { createAccident } from "@/server/services/accident.service";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import type { AccidentType, AccidentStatus, SifClassification, Criticality } from "@/generated/prisma/enums";
import {
  ACCIDENT_IMPORT_FIELDS,
  type AccidentImportField,
  type AccidentImportMapping,
} from "@/domain/accident/import-fields";
import {
  parseSpreadsheet,
  suggestMapping as suggestMappingGeneric,
  getCell,
  normalize,
  parseDateCell,
} from "@/lib/spreadsheet-import";

export type { AccidentImportField, AccidentImportMapping };
export { parseSpreadsheet };

const FIELD_ALIASES: Record<AccidentImportField, string[]> = {
  date: ["data", "dataocorrencia", "dataacidente", "dataregistro"],
  time: ["hora", "horario", "horadoacidente"],
  type: ["tipo", "tipoacidente", "tipodeocorrencia", "tipoocorrencia"],
  severity: ["severidade", "gravidade"],
  area: ["area", "local", "setor"],
  description: ["descricao", "descricaodaocorrencia", "relato", "resumo"],
  immediateCause: ["causaimediata", "causadireta"],
  rootCause: ["causaraiz", "causabase", "causafundamental"],
  isSif: ["esif", "sif"],
  sifClassification: ["classificacaosif", "tiposif", "classifsif"],
  creditNumber: ["credit", "numerocredit", "ncredit", "numerodocredit"],
  involvedCollaborators: ["envolvidos", "colaboradoresenvolvidos", "vitimas", "acidentado", "acidentados", "nomedoacidentado"],
  status: ["status", "situacao"],
};

const TYPE_ALIASES: Record<string, AccidentType> = {
  acidentetipico: "ACIDENTE_TIPICO",
  tipico: "ACIDENTE_TIPICO",
  acidente: "ACIDENTE_TIPICO",
  acidentedetrajeto: "ACIDENTE_TRAJETO",
  trajeto: "ACIDENTE_TRAJETO",
  quaseacidente: "QUASE_ACIDENTE",
  quase: "QUASE_ACIDENTE",
  doencaocupacional: "DOENCA_OCUPACIONAL",
  doenca: "DOENCA_OCUPACIONAL",
  // Vocabulário de classificação de severidade de lesão (comum em exportações de sistemas
  // corporativos de SST, ex: ABInbev) — "sem lesão" = quase acidente, os demais tiveram lesão.
  incidentessemlesao: "QUASE_ACIDENTE",
  semlesao: "QUASE_ACIDENTE",
  faiprimeiroatendimentoambulatorial: "ACIDENTE_TIPICO",
  fai: "ACIDENTE_TIPICO",
  mdiacidentesemafastamentocomtrabalhocompativel: "ACIDENTE_TIPICO",
  mdi: "ACIDENTE_TIPICO",
  ltiacidentecomafastamento: "ACIDENTE_TIPICO",
  lti: "ACIDENTE_TIPICO",
  mtiacidentesemafastamento: "ACIDENTE_TIPICO",
  mti: "ACIDENTE_TIPICO",
};

const SEVERITY_ALIASES: Record<string, Criticality> = {
  baixa: "BAIXA",
  media: "MEDIA",
  alta: "ALTA",
  critica: "CRITICA",
};

const SIF_CLASS_ALIASES: Record<string, SifClassification> = {
  precursor: "SIF_PRECURSOR",
  sifprecursor: "SIF_PRECURSOR",
  potencial: "SIF_POTENCIAL",
  sifpotencial: "SIF_POTENCIAL",
  potential: "SIF_POTENCIAL",
  sifpotential: "SIF_POTENCIAL",
  real: "SIF_REAL",
  sifreal: "SIF_REAL",
  actual: "SIF_REAL",
  sifactual: "SIF_REAL",
};

const STATUS_ALIASES: Record<string, AccidentStatus> = {
  aberto: "ABERTO",
  eminvestigacao: "EM_INVESTIGACAO",
  investigacao: "EM_INVESTIGACAO",
  concluido: "CONCLUIDO",
  encerrado: "CONCLUIDO",
  fechado: "CONCLUIDO",
  finalizado: "CONCLUIDO",
};

function resolveSeverity(raw: string | null, fallback: Criticality): Criticality {
  if (!raw) return fallback;
  return SEVERITY_ALIASES[normalize(raw)] ?? fallback;
}

function parseBoolean(raw: string | null): boolean {
  if (!raw) return false;
  const n = normalize(raw);
  return n === "sim" || n === "s" || n === "true" || n === "1" || n === "yes" || n === "x";
}

export function suggestMapping(headers: string[]): AccidentImportMapping {
  return suggestMappingGeneric(
    headers,
    ACCIDENT_IMPORT_FIELDS.map((f) => f.key),
    FIELD_ALIASES,
  );
}

export type AccidentImportRowResult = {
  rowIndex: number;
  action: "create" | "error";
  date: string;
  dateParsed: Date | null;
  time: string | null;
  type: string | null;
  typeValue: AccidentType | null;
  severity: string | null;
  severityValue: Criticality;
  area: string | null;
  areaId?: string;
  areaUnmatched?: boolean;
  description: string;
  immediateCause: string | null;
  rootCause: string | null;
  isSif: boolean;
  sifClassification: SifClassification | null;
  creditNumber: string | null;
  involvedNames: string[];
  involvedCollaboratorIds: string[];
  unmatchedNames: string[];
  status: AccidentStatus;
  error?: string;
};

/** Monta o preview linha a linha. Sem chave de negócio pra casar com registro existente (acidente
 * não tem "código" na planilha do usuário) — toda linha válida vira uma criação nova; reimportar o
 * mesmo arquivo duplica os registros, então revise antes de confirmar. Colaboradores envolvidos são
 * casados pelo nome (normalizado); os que não baterem ficam listados mas não bloqueiam a linha —
 * o acidente é criado sem aquele envolvido específico. Sem coluna de Status, assume "Concluído"
 * (são registros históricos já resolvidos); com uma coluna reconhecida, respeita o que veio nela. */
export async function buildAccidentImportPreview(
  user: CurrentUser,
  rows: string[][],
  mapping: AccidentImportMapping,
): Promise<AccidentImportRowResult[]> {
  requirePermission(user, PERMISSIONS.ACCIDENT_MANAGE);

  const [areas, collaborators] = await Promise.all([
    db.area.findMany({ where: { active: true } }),
    db.collaborator.findMany({ where: { active: true }, select: { id: true, name: true } }),
  ]);
  const findArea = (name: string | null) =>
    name ? areas.find((a) => a.name.trim().toLowerCase() === name.trim().toLowerCase()) : undefined;
  const collabByName = new Map(collaborators.map((c) => [normalize(c.name), c.id]));

  const results: AccidentImportRowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.every((c) => !c || c.trim() === "")) continue;

    const dateRaw = getCell(row, mapping, "date");
    const time = getCell(row, mapping, "time");
    const typeRaw = getCell(row, mapping, "type");
    const severityRaw = getCell(row, mapping, "severity");
    const areaRaw = getCell(row, mapping, "area");
    const description = getCell(row, mapping, "description");
    const immediateCause = getCell(row, mapping, "immediateCause");
    const rootCause = getCell(row, mapping, "rootCause");
    const isSifRaw = getCell(row, mapping, "isSif");
    const sifClassRaw = getCell(row, mapping, "sifClassification");
    const creditNumber = getCell(row, mapping, "creditNumber");
    const involvedRaw = getCell(row, mapping, "involvedCollaborators");
    const statusRaw = getCell(row, mapping, "status");

    const involvedNames = involvedRaw
      ? involvedRaw.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
      : [];
    const involvedCollaboratorIds: string[] = [];
    const unmatchedNames: string[] = [];
    for (const name of involvedNames) {
      const id = collabByName.get(normalize(name));
      if (id) involvedCollaboratorIds.push(id);
      else unmatchedNames.push(name);
    }

    const base = {
      rowIndex: i,
      date: dateRaw ?? "",
      time,
      type: typeRaw,
      severity: severityRaw,
      area: areaRaw,
      description: description ?? "",
      immediateCause,
      rootCause,
      creditNumber,
      involvedNames,
      involvedCollaboratorIds,
      unmatchedNames,
    };

    const dateParsed = parseDateCell(dateRaw);
    if (!dateParsed) {
      results.push({
        ...base,
        dateParsed: null,
        typeValue: null,
        severityValue: "MEDIA",
        isSif: false,
        sifClassification: null,
        status: "CONCLUIDO",
        action: "error",
        error: "Data inválida ou não informada.",
      });
      continue;
    }

    const typeValue = typeRaw ? (TYPE_ALIASES[normalize(typeRaw)] ?? null) : null;
    if (!typeValue) {
      results.push({
        ...base,
        dateParsed,
        typeValue: null,
        severityValue: "MEDIA",
        isSif: false,
        sifClassification: null,
        status: "CONCLUIDO",
        action: "error",
        error: `Tipo "${typeRaw ?? ""}" não reconhecido — use Acidente Típico, Acidente de Trajeto, Quase Acidente ou Doença Ocupacional.`,
      });
      continue;
    }

    if (!description) {
      results.push({
        ...base,
        dateParsed,
        typeValue,
        severityValue: "MEDIA",
        isSif: false,
        sifClassification: null,
        status: "CONCLUIDO",
        action: "error",
        error: "Informe a descrição do acidente.",
      });
      continue;
    }

    // Área não cadastrada não bloqueia a linha — é um dado a mais, não uma chave obrigatória
    // (diferente do import de equipamentos, onde área errada vincularia à unidade errada).
    const matchedArea = findArea(areaRaw);
    const areaUnmatched = !!areaRaw && !matchedArea;

    const isSif = parseBoolean(isSifRaw);
    const sifClassification = isSif && sifClassRaw ? (SIF_CLASS_ALIASES[normalize(sifClassRaw)] ?? null) : null;
    const status = statusRaw ? (STATUS_ALIASES[normalize(statusRaw)] ?? "ABERTO") : "CONCLUIDO";

    results.push({
      ...base,
      dateParsed,
      typeValue,
      severityValue: resolveSeverity(severityRaw, "MEDIA"),
      areaId: matchedArea?.id,
      areaUnmatched,
      isSif,
      sifClassification,
      status,
      action: "create",
    });
  }

  return results;
}

/** Reaproveita `createAccident` linha a linha (não escreve direto no banco) — mesmo motivo do
 * import de equipamentos: os efeitos colaterais (auditoria, envolvimentos) são exatamente os
 * esperados de um cadastro em lote. */
export async function commitAccidentImport(
  user: CurrentUser,
  rows: AccidentImportRowResult[],
): Promise<{ created: number; errors: number }> {
  requirePermission(user, PERMISSIONS.ACCIDENT_MANAGE);

  let created = 0;
  let errors = 0;

  for (const row of rows) {
    if (row.action === "error" || !row.dateParsed || !row.typeValue) {
      errors++;
      continue;
    }
    try {
      await createAccident(user, {
        date: row.dateParsed,
        time: row.time,
        areaId: row.areaId ?? null,
        type: row.typeValue,
        severity: row.severityValue,
        description: row.description,
        immediateCause: row.immediateCause,
        rootCause: row.rootCause,
        isSif: row.isSif,
        sifClassification: row.sifClassification,
        creditNumber: row.creditNumber,
        involvedCollaboratorIds: row.involvedCollaboratorIds,
        witnessCollaboratorIds: [],
        status: row.status,
      });
      created++;
    } catch (error) {
      console.error(`[accident-import] falha ao importar linha ${row.rowIndex}:`, error);
      errors++;
    }
  }

  await recordAudit({
    userId: user.id,
    action: "CREATE",
    entityType: "AccidentImport",
    entityId: crypto.randomUUID(),
    newValue: { created, errors, total: rows.length },
  });

  return { created, errors };
}
