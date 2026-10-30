import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import { createAccident } from "@/server/services/accident.service";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import type { AccidentType, AccidentStatus, SifClassification, Criticality } from "@/generated/prisma/enums";
import {
  ACCIDENT_FIELD_ALIASES,
  ACCIDENT_IMPORT_FIELDS,
  isLog20Company,
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
  faiprimeiroatendimentoambulatorial: "FAI",
  fai: "FAI",
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
    ACCIDENT_FIELD_ALIASES,
  );
}

export type AccidentImportRowResult = {
  rowIndex: number;
  /** `skip`: linha ignorada de propósito (outra empresa, ou Credit que já foi importado) — não conta como erro. */
  action: "create" | "error" | "skip";
  skipReason?: string;
  /** O tipo não veio na planilha (ou não foi reconhecido) e foi usado o tipo padrão escolhido na importação. */
  typeAssumed?: boolean;
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
  /** Envolvido como veio da planilha (nome completo, SAP e cargo), com o colaborador cadastrado quando achado. */
  involvedPeople: { name: string; sap: string | null; cargo: string | null; collaboratorId: string | null }[];
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
  defaultType: AccidentType = "ACIDENTE_TIPICO",
): Promise<AccidentImportRowResult[]> {
  requirePermission(user, PERMISSIONS.ACCIDENT_MANAGE);

  const [areas, collaborators] = await Promise.all([
    db.area.findMany({ where: { active: true } }),
    db.collaborator.findMany({ where: { active: true }, select: { id: true, name: true, matricula: true } }),
  ]);
  const findArea = (name: string | null) =>
    name ? areas.find((a) => a.name.trim().toLowerCase() === name.trim().toLowerCase()) : undefined;
  const collabByName = new Map(collaborators.map((c) => [normalize(c.name), c.id]));
  const collabBySap = new Map(collaborators.filter((c) => c.matricula).map((c) => [normalize(c.matricula ?? ""), c.id]));
  // Credit já cadastrado: reimportar a mesma planilha não duplica.
  const existingCredits = new Set(
    (await db.accident.findMany({ where: { creditNumber: { not: null } }, select: { creditNumber: true } })).map((a) => normalize(a.creditNumber ?? "")),
  );
  const seenCredits = new Set<string>();

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
    const companyRaw = getCell(row, mapping, "company");
    const firstName = getCell(row, mapping, "involvedFirstName");
    const lastName = getCell(row, mapping, "involvedLastName");
    const sap = getCell(row, mapping, "involvedSap");
    const cargo = getCell(row, mapping, "involvedCargo");

    // O Credit separa nome e sobrenome em colunas: juntar os dois dá o nome completo do envolvido.
    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
    const involvedNames = [
      ...(involvedRaw ? involvedRaw.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : []),
      ...(fullName ? [fullName] : []),
    ];
    const involvedCollaboratorIds: string[] = [];
    const unmatchedNames: string[] = [];
    const involvedPeople: AccidentImportRowResult["involvedPeople"] = [];
    for (const name of involvedNames) {
      const isFull = name === fullName;
      const id = (isFull && sap ? collabBySap.get(normalize(sap)) : undefined) ?? collabByName.get(normalize(name));
      if (id) {
        if (!involvedCollaboratorIds.includes(id)) involvedCollaboratorIds.push(id);
      } else unmatchedNames.push(name);
      involvedPeople.push({ name, sap: isFull ? sap : null, cargo: isFull ? cargo : null, collaboratorId: id ?? null });
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
      involvedPeople,
    };

    // Planilha do Credit traz também outras empresas: só a LOG20 entra. Linha sem empresa preenchida NÃO entra (no Credit, vazio é funcionário da Ambev).
    if (mapping.company !== undefined && !(companyRaw && isLog20Company(companyRaw))) {
      results.push({
        ...base,
        dateParsed: parseDateCell(dateRaw),
        typeValue: null,
        severityValue: "MEDIA",
        isSif: false,
        sifClassification: null,
        status: "CONCLUIDO",
        action: "skip",
        skipReason: companyRaw ? `Outra empresa (${companyRaw})` : "Empresa não informada (não é da LOG20)",
      });
      continue;
    }
    if (creditNumber) {
      const key = normalize(creditNumber);
      if (existingCredits.has(key) || seenCredits.has(key)) {
        results.push({
          ...base,
          dateParsed: parseDateCell(dateRaw),
          typeValue: null,
          severityValue: "MEDIA",
          isSif: false,
          sifClassification: null,
          status: "CONCLUIDO",
          action: "skip",
          skipReason: existingCredits.has(key) ? "Credit já importado antes" : "Credit repetido na planilha",
        });
        continue;
      }
      seenCredits.add(key);
    }

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

    // Tipo não é obrigatório: vazio ou não reconhecido usa o tipo padrão escolhido na tela (marcado como "assumido" na revisão).
    const recognizedType = typeRaw ? (TYPE_ALIASES[normalize(typeRaw)] ?? null) : null;
    const typeValue: AccidentType = recognizedType ?? defaultType;
    const typeAssumed = !recognizedType;

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
      typeAssumed,
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
): Promise<{ created: number; errors: number; skipped: number }> {
  requirePermission(user, PERMISSIONS.ACCIDENT_MANAGE);

  let created = 0;
  let errors = 0;
  let skipped = 0;

  for (const row of rows) {
    if (row.action === "skip") {
      skipped++;
      continue;
    }
    if (row.action === "error" || !row.dateParsed || !row.typeValue) {
      errors++;
      continue;
    }
    try {
      const accident = await createAccident(user, {
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
      // Nome completo, SAP e cargo do envolvido (inclusive quem não é colaborador cadastrado). Se a tabela ainda não existir, o acidente fica criado assim mesmo.
      if (row.involvedPeople?.length) {
        try {
          await db.accidentInvolvedPerson.createMany({
            data: row.involvedPeople.map((p) => ({ accidentId: accident.id, name: p.name.slice(0, 200), sap: p.sap?.slice(0, 60) ?? null, cargo: p.cargo?.slice(0, 120) ?? null, collaboratorId: p.collaboratorId })),
          });
        } catch (peopleError) {
          console.error("[accident-import] não consegui guardar os envolvidos (SAP/cargo):", peopleError);
        }
      }
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
    newValue: { created, errors, skipped, total: rows.length },
  });

  return { created, errors, skipped };
}
