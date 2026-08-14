import "dotenv/config";
import { db } from "../src/server/db";
import { hashPassword } from "../src/server/auth/passwords";
import {
  PERMISSION_DESCRIPTIONS,
  ROLE_KEYS,
  ROLE_LABELS,
  DEFAULT_ROLE_PERMISSIONS,
  type RoleKeyValue,
} from "../src/domain/shared/permissions";

const DEMO_PASSWORD = "Demo@123";

async function seedPermissionsAndRoles() {
  for (const [key, description] of Object.entries(PERMISSION_DESCRIPTIONS)) {
    await db.permission.upsert({
      where: { key },
      update: { description },
      create: { key, description },
    });
  }

  const roleIds: Record<RoleKeyValue, string> = {} as Record<RoleKeyValue, string>;

  for (const roleKey of Object.values(ROLE_KEYS)) {
    const role = await db.role.upsert({
      where: { key: roleKey },
      update: { name: ROLE_LABELS[roleKey] },
      create: { key: roleKey, name: ROLE_LABELS[roleKey] },
    });
    roleIds[roleKey] = role.id;
  }

  for (const roleKey of Object.values(ROLE_KEYS)) {
    const permissionKeys = DEFAULT_ROLE_PERMISSIONS[roleKey];
    const permissions = await db.permission.findMany({
      where: { key: { in: permissionKeys } },
    });
    for (const permission of permissions) {
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: roleIds[roleKey], permissionId: permission.id } },
        update: {},
        create: { roleId: roleIds[roleKey], permissionId: permission.id },
      });
    }
  }

  return roleIds;
}

async function seedOrgStructure() {
  const unit = await db.unit.upsert({
    where: { code: "UN-01" },
    update: {},
    create: { code: "UN-01", name: "Unidade Central" },
  });

  const areaDefs = [
    { code: "AR-REC", name: "Recebimento" },
    { code: "AR-ARM", name: "Armazenagem" },
    { code: "AR-SEP", name: "Separação" },
    { code: "AR-EXP", name: "Expedição" },
  ];

  const areas: Record<string, string> = {};
  for (const def of areaDefs) {
    const area = await db.area.upsert({
      where: { code: def.code },
      update: {},
      create: { code: def.code, name: def.name, unitId: unit.id },
    });
    areas[def.name] = area.id;
  }

  return { unit, areas };
}

async function seedUsers(roleIds: Record<RoleKeyValue, string>, unitId: string, areaIds: Record<string, string>) {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const colaborador = await db.user.upsert({
    where: { email: "colaborador@demo.com" },
    update: {},
    create: {
      email: "colaborador@demo.com",
      name: "Carlos Andrade",
      passwordHash,
      roleId: roleIds.COLABORADOR,
      unitId,
    },
  });

  const lider = await db.user.upsert({
    where: { email: "lider@demo.com" },
    update: {},
    create: {
      email: "lider@demo.com",
      name: "Luciana Ferreira",
      passwordHash,
      roleId: roleIds.LIDER_SUPERVISOR,
      unitId,
    },
  });

  const gestor = await db.user.upsert({
    where: { email: "gestor@demo.com" },
    update: {},
    create: {
      email: "gestor@demo.com",
      name: "Gustavo Ramos",
      passwordHash,
      roleId: roleIds.GESTOR,
      unitId,
    },
  });

  const admin = await db.user.upsert({
    where: { email: "admin@demo.com" },
    update: {},
    create: {
      email: "admin@demo.com",
      name: "Amanda Souza",
      passwordHash,
      roleId: roleIds.ADMINISTRADOR,
      unitId,
    },
  });

  const colaboradorAreas = [areaIds["Expedição"], areaIds["Separação"]];
  const liderAreas = [areaIds["Expedição"], areaIds["Separação"], areaIds["Armazenagem"]];

  for (const areaId of colaboradorAreas) {
    await db.userArea.upsert({
      where: { userId_areaId: { userId: colaborador.id, areaId } },
      update: {},
      create: { userId: colaborador.id, areaId },
    });
  }
  for (const areaId of liderAreas) {
    await db.userArea.upsert({
      where: { userId_areaId: { userId: lider.id, areaId } },
      update: {},
      create: { userId: lider.id, areaId },
    });
  }

  return { colaborador, lider, gestor, admin };
}

async function seedEquipmentTypes() {
  const defs = [
    { code: "TE-PE", name: "Paleteira Elétrica" },
    { code: "TE-PM", name: "Paleteira Manual" },
    { code: "TE-EMP", name: "Empilhadeira" },
    { code: "TE-FE", name: "Ferramenta Elétrica" },
  ];

  const types: Record<string, string> = {};
  for (const def of defs) {
    const type = await db.equipmentType.upsert({
      where: { code: def.code },
      update: {},
      create: def,
    });
    types[def.name] = type.id;
  }
  return types;
}

async function seedFaultCategories() {
  const names = ["Freios", "Rodas e Rodízios", "Estrutura", "Elétrica / Bateria", "Comandos e Controles", "Vazamento Hidráulico"];
  const categories: Record<string, string> = {};
  for (const name of names) {
    const category = await db.faultCategory.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    categories[name] = category.id;
  }
  return categories;
}

async function seedQualificationTypes() {
  const defs: { name: string; category: "NR" | "ASO" | "INTEGRACAO" | "OUTRO"; validityMonths: number | null }[] = [
    { name: "NR-11 — Transporte e Movimentação de Materiais", category: "NR", validityMonths: 12 },
    { name: "NR-35 — Trabalho em Altura", category: "NR", validityMonths: 24 },
    { name: "NR-33 — Espaço Confinado", category: "NR", validityMonths: 12 },
    { name: "NR-12 — Segurança em Máquinas e Equipamentos", category: "NR", validityMonths: 24 },
    { name: "NR-10 — Segurança em Instalações Elétricas", category: "NR", validityMonths: 24 },
    { name: "NR-18 — Condições de Segurança na Construção", category: "NR", validityMonths: 12 },
    { name: "NR-20 — Inflamáveis e Combustíveis", category: "NR", validityMonths: 12 },
    { name: "Integração", category: "INTEGRACAO", validityMonths: null },
    { name: "ASO — Atestado de Saúde Ocupacional", category: "ASO", validityMonths: 12 },
  ];

  const types: Record<string, string> = {};
  for (const def of defs) {
    const type = await db.qualificationType.upsert({
      where: { name: def.name },
      update: {},
      create: def,
    });
    types[def.name] = type.id;
  }
  return types;
}

async function seedScheduleTypes() {
  const defs: { name: string; workDays: number; restDays: number }[] = [
    { name: "6x1", workDays: 6, restDays: 1 },
    { name: "6x2", workDays: 6, restDays: 2 },
    { name: "5x2", workDays: 5, restDays: 2 },
  ];

  for (const def of defs) {
    await db.scheduleType.upsert({
      where: { name: def.name },
      update: {},
      create: def,
    });
  }
}

async function seedEpiTypes() {
  const defs: { name: string; defaultCa: string | null; validityMonths: number | null }[] = [
    { name: "Botina de Segurança", defaultCa: null, validityMonths: null },
    { name: "Capacete de Segurança", defaultCa: null, validityMonths: null },
    { name: "Protetor Auricular", defaultCa: null, validityMonths: null },
    { name: "Óculos de Proteção Incolor", defaultCa: null, validityMonths: null },
    { name: "Luva Anticorte", defaultCa: null, validityMonths: null },
    { name: "Jaqueta", defaultCa: null, validityMonths: null },
    { name: "Camisa Manga Longa", defaultCa: null, validityMonths: null },
    { name: "Calça", defaultCa: null, validityMonths: null },
    { name: "Cinturão Paraquedista", defaultCa: null, validityMonths: 12 },
  ];

  const types: Record<string, string> = {};
  for (const def of defs) {
    const type = await db.epiType.upsert({
      where: { name: def.name },
      update: {},
      create: def,
    });
    types[def.name] = type.id;
  }
  return types;
}

async function seedJobFunctions(epiTypes: Record<string, string>) {
  const jobFunction = await db.jobFunction.upsert({
    where: { name: "Operador de Empilhadeira" },
    update: {},
    create: { name: "Operador de Empilhadeira" },
  });

  const kitItemNames = ["Botina de Segurança", "Capacete de Segurança", "Protetor Auricular", "Óculos de Proteção Incolor", "Luva Anticorte"];
  for (const name of kitItemNames) {
    const epiTypeId = epiTypes[name];
    if (!epiTypeId) continue;
    await db.jobFunctionEpiKitItem.upsert({
      where: { jobFunctionId_epiTypeId: { jobFunctionId: jobFunction.id, epiTypeId } },
      update: {},
      create: { jobFunctionId: jobFunction.id, epiTypeId, quantity: 1 },
    });
  }
}

async function seedEquipments(params: {
  unitId: string;
  areaId: string;
  typeId: string;
  responsibleId: string;
  registeredById: string;
}) {
  const codes = ["PE-001", "PE-002", "PE-003", "PE-004"];
  const equipments: Record<string, { id: string }> = {};

  for (const code of codes) {
    const equipment = await db.equipment.upsert({
      where: { code },
      update: {},
      create: {
        code,
        name: `Paleteira Elétrica ${code}`,
        assetTag: `PAT-${code}`,
        typeId: params.typeId,
        manufacturer: "Still",
        model: "EXU 12",
        serialNumber: `SN-${code}-2024`,
        unitId: params.unitId,
        areaId: params.areaId,
        responsibleId: params.responsibleId,
        registeredById: params.registeredById,
        criticality: code === "PE-003" ? "ALTA" : "MEDIA",
      },
    });
    equipments[code] = equipment;
  }

  return equipments;
}

async function seedChecklistTemplate(params: {
  equipmentTypeId: string;
  createdById: string;
  publishedById: string;
  faultCategories: Record<string, string>;
}) {
  const template = await db.checklistTemplate.upsert({
    where: { id: "seed-template-paleteira-eletrica" },
    update: {},
    create: {
      id: "seed-template-paleteira-eletrica",
      name: "Inspeção Diária — Paleteira Elétrica",
      description: "Checklist diário de inspeção pré-uso de paleteiras elétricas.",
      equipmentTypeId: params.equipmentTypeId,
      status: "PUBLICADO",
      createdById: params.createdById,
    },
  });

  const version = await db.checklistVersion.upsert({
    where: { templateId_versionNumber: { templateId: template.id, versionNumber: 1 } },
    update: {},
    create: {
      templateId: template.id,
      versionNumber: 1,
      periodicity: "DIARIO",
      status: "ATIVA",
      effectiveFrom: new Date(),
      publishedById: params.publishedById,
      publishedAt: new Date(),
    },
  });

  const existingQuestions = await db.checklistQuestion.count({ where: { versionId: version.id } });
  if (existingQuestions > 0) {
    return { template, version };
  }

  type QuestionDef = {
    order: number;
    title: string;
    type: "CONFORME_NAO_CONFORME" | "SIM_NAO";
    rule?: {
      triggerValue: string;
      isCritical?: boolean;
      requiresComment?: boolean;
      requiresPhoto?: boolean;
      createsNonconformity?: boolean;
      blocksEquipment?: boolean;
      severity?: "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
      newEquipmentStatus?: "RESTRITO" | "BLOQUEADO" | "LIBERADO_COM_OBSERVACAO";
      faultCategory?: string;
    };
  };

  const questions: QuestionDef[] = [
    {
      order: 1,
      title: "Estado das rodas está adequado?",
      type: "CONFORME_NAO_CONFORME",
      rule: {
        triggerValue: "NAO_CONFORME",
        requiresComment: true,
        createsNonconformity: true,
        severity: "MEDIA",
        faultCategory: "Rodas e Rodízios",
      },
    },
    {
      order: 2,
      title: "Buzina está funcionando?",
      type: "SIM_NAO",
      rule: {
        triggerValue: "NAO",
        requiresComment: true,
        createsNonconformity: true,
        severity: "BAIXA",
        faultCategory: "Elétrica / Bateria",
      },
    },
    {
      order: 3,
      title: "Sistema de frenagem está funcionando?",
      type: "SIM_NAO",
      rule: {
        triggerValue: "NAO",
        isCritical: true,
        requiresComment: true,
        requiresPhoto: true,
        createsNonconformity: true,
        blocksEquipment: true,
        severity: "CRITICA",
        newEquipmentStatus: "BLOQUEADO",
        faultCategory: "Freios",
      },
    },
    {
      order: 4,
      title: "Garfos apresentam deformações?",
      type: "SIM_NAO",
      rule: {
        triggerValue: "SIM",
        requiresComment: true,
        requiresPhoto: true,
        createsNonconformity: true,
        severity: "ALTA",
        newEquipmentStatus: "RESTRITO",
        faultCategory: "Estrutura",
      },
    },
    {
      order: 5,
      title: "Existe vazamento aparente?",
      type: "SIM_NAO",
      rule: {
        triggerValue: "SIM",
        requiresComment: true,
        requiresPhoto: true,
        createsNonconformity: true,
        severity: "ALTA",
        newEquipmentStatus: "RESTRITO",
        faultCategory: "Vazamento Hidráulico",
      },
    },
    {
      order: 6,
      title: "Bateria apresenta anormalidade?",
      type: "SIM_NAO",
      rule: {
        triggerValue: "SIM",
        requiresComment: true,
        createsNonconformity: true,
        severity: "MEDIA",
        faultCategory: "Elétrica / Bateria",
      },
    },
    {
      order: 7,
      title: "Comandos estão funcionando corretamente?",
      type: "SIM_NAO",
      rule: {
        triggerValue: "NAO",
        requiresComment: true,
        requiresPhoto: true,
        createsNonconformity: true,
        severity: "ALTA",
        newEquipmentStatus: "RESTRITO",
        faultCategory: "Comandos e Controles",
      },
    },
    {
      order: 8,
      title: "Estrutura apresenta danos visíveis?",
      type: "SIM_NAO",
      rule: {
        triggerValue: "SIM",
        requiresComment: true,
        createsNonconformity: true,
        severity: "MEDIA",
        faultCategory: "Estrutura",
      },
    },
  ];

  for (const q of questions) {
    const question = await db.checklistQuestion.create({
      data: {
        versionId: version.id,
        order: q.order,
        title: q.title,
        type: q.type,
        required: true,
        allowNotApplicable: false,
      },
    });

    if (q.rule) {
      await db.questionRule.create({
        data: {
          questionId: question.id,
          triggerValue: q.rule.triggerValue,
          isCritical: q.rule.isCritical ?? false,
          requiresComment: q.rule.requiresComment ?? false,
          requiresPhoto: q.rule.requiresPhoto ?? false,
          createsNonconformity: q.rule.createsNonconformity ?? false,
          blocksEquipment: q.rule.blocksEquipment ?? false,
          severity: q.rule.severity,
          newEquipmentStatus: q.rule.newEquipmentStatus,
          faultCategoryId: q.rule.faultCategory ? params.faultCategories[q.rule.faultCategory] : null,
        },
      });
    }
  }

  return { template, version };
}

async function main() {
  console.log("Seed: permissões e perfis...");
  const roleIds = await seedPermissionsAndRoles();

  console.log("Seed: estrutura organizacional...");
  const { unit, areas } = await seedOrgStructure();

  console.log("Seed: usuários de demonstração...");
  const users = await seedUsers(roleIds, unit.id, areas);

  console.log("Seed: tipos de equipamento...");
  const types = await seedEquipmentTypes();

  console.log("Seed: categorias de falha...");
  const faultCategories = await seedFaultCategories();

  console.log("Seed: catálogo de qualificações (NR/ASO/Integração)...");
  await seedQualificationTypes();

  console.log("Seed: tipos de escala (6x1, 6x2, 5x2)...");
  await seedScheduleTypes();

  console.log("Seed: catálogo de EPI e kit por função...");
  const epiTypes = await seedEpiTypes();
  await seedJobFunctions(epiTypes);

  console.log("Seed: equipamentos...");
  const equipments = await seedEquipments({
    unitId: unit.id,
    areaId: areas["Expedição"],
    typeId: types["Paleteira Elétrica"],
    responsibleId: users.lider.id,
    registeredById: users.admin.id,
  });

  console.log("Seed: modelo de checklist...");
  const { template } = await seedChecklistTemplate({
    equipmentTypeId: types["Paleteira Elétrica"],
    createdById: users.admin.id,
    publishedById: users.admin.id,
    faultCategories,
  });

  console.log("Seed: vínculos e agendas de checklist...");
  for (const code of Object.keys(equipments)) {
    const equipment = equipments[code];
    await db.equipmentChecklistAssignment.upsert({
      where: { equipmentId_templateId: { equipmentId: equipment.id, templateId: template.id } },
      update: {},
      create: { equipmentId: equipment.id, templateId: template.id },
    });

    const existingSchedule = await db.checklistSchedule.findFirst({
      where: { equipmentId: equipment.id, templateId: template.id },
    });
    if (!existingSchedule) {
      const version = await db.checklistVersion.findFirstOrThrow({
        where: { templateId: template.id, status: "ATIVA" },
      });
      await db.checklistSchedule.create({
        data: {
          equipmentId: equipment.id,
          templateId: template.id,
          versionId: version.id,
          periodicity: "DIARIO",
          timeOfDay: "07:00",
        },
      });
    }
  }

  console.log("\nSeed concluído.");
  console.log("Usuários de demonstração (senha para todos: Demo@123):");
  console.log("  colaborador@demo.com  — Colaborador");
  console.log("  lider@demo.com        — Líder / Supervisor");
  console.log("  gestor@demo.com       — Gestor");
  console.log("  admin@demo.com        — Administrador");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
