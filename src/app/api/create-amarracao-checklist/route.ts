import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

/**
 * Rota temporária — cria o "Checklist de Amarração" em produção: uma pergunta
 * Conforme/Não conforme (com N/A), regra que exige foto+comentário e gera não conformidade
 * quando "Não conforme", publicada e vinculada a todo equipamento ativo da área Amarração.
 * Remover depois de usar.
 */
const TOKEN = "6a1f4d8b2e5c9a3f7d0b6e4c8a1f5d9b3e7c0a4f8d2b6e9c3a7f1d5b8e2c6a0f";

const AREA_NAME_MATCH = "amarr";
const TEMPLATE_NAME = "Checklist de Amarração";
const QUESTION_TITLE = "Equipamento em condições de uso, sem danos ou desgaste aparente?";

async function plan() {
  const area = await db.area.findFirst({ where: { name: { contains: AREA_NAME_MATCH, mode: "insensitive" } } });
  if (!area) return { error: "Área 'Amarração' não encontrada." };

  const equipments = await db.equipment.findMany({
    where: { areaId: area.id, active: true },
    select: { id: true, code: true, name: true, typeId: true },
  });
  if (equipments.length === 0) return { error: "Nenhum equipamento ativo na área." };

  const typeCounts = new Map<string, number>();
  for (const e of equipments) typeCounts.set(e.typeId, (typeCounts.get(e.typeId) ?? 0) + 1);
  const mostCommonTypeId = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];

  const actor = await db.user.findFirst({ where: { role: { key: "ADMINISTRADOR" }, active: true }, orderBy: { createdAt: "asc" } });
  if (!actor) return { error: "Nenhum usuário Administrador ativo encontrado pra atribuir como autor." };

  const existingTemplate = await db.checklistTemplate.findFirst({ where: { name: TEMPLATE_NAME } });

  return {
    area: { id: area.id, name: area.name, code: area.code },
    equipmentCount: equipments.length,
    equipmentCodes: equipments.map((e) => e.code),
    mostCommonTypeId,
    actor: { id: actor.id, name: actor.name },
    alreadyExists: !!existingTemplate,
    existingTemplateId: existingTemplate?.id ?? null,
  };
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const action = request.nextUrl.searchParams.get("action") === "create" ? "create" : "plan";

  const info = await plan();
  if ("error" in info) return NextResponse.json({ action, error: info.error });

  if (action === "plan") {
    return NextResponse.json({ action, info });
  }

  if (info.alreadyExists) {
    return NextResponse.json({ action, info, error: "Template já existe, não criei de novo." });
  }

  const area = await db.area.findFirst({ where: { name: { contains: AREA_NAME_MATCH, mode: "insensitive" } } });
  const equipments = await db.equipment.findMany({
    where: { areaId: area!.id, active: true },
    select: { id: true },
  });

  const result = await db.$transaction(async (tx) => {
    const template = await tx.checklistTemplate.create({
      data: {
        name: TEMPLATE_NAME,
        description: `Checklist padrão pros equipamentos da área ${area!.name}.`,
        equipmentTypeId: info.mostCommonTypeId,
        createdById: info.actor.id,
      },
    });

    const version = await tx.checklistVersion.create({
      data: { templateId: template.id, versionNumber: 1, periodicity: "DIARIO" },
    });

    const question = await tx.checklistQuestion.create({
      data: {
        versionId: version.id,
        order: 1,
        title: QUESTION_TITLE,
        type: "CONFORME_NAO_CONFORME",
        required: true,
        allowNotApplicable: true,
      },
    });

    await tx.questionRule.create({
      data: {
        questionId: question.id,
        triggerValue: "NAO_CONFORME",
        requiresComment: true,
        requiresPhoto: true,
        createsNonconformity: true,
      },
    });

    await tx.checklistVersion.update({
      where: { id: version.id },
      data: { status: "ATIVA", publishedById: info.actor.id, publishedAt: new Date(), effectiveFrom: new Date() },
    });
    await tx.checklistTemplate.update({ where: { id: template.id }, data: { status: "PUBLICADO" } });

    for (const eq of equipments) {
      await tx.equipmentChecklistAssignment.upsert({
        where: { equipmentId_templateId: { equipmentId: eq.id, templateId: template.id } },
        update: { active: true },
        create: { equipmentId: eq.id, templateId: template.id },
      });
    }

    return { templateId: template.id, versionId: version.id, questionId: question.id, assignedCount: equipments.length };
  });

  return NextResponse.json({ action, info, result });
}
