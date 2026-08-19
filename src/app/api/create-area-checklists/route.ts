import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

/**
 * Rota temporária — cria um "Checklist de {área}" pra cada área cadastrada que ainda não tem
 * um (mesma pergunta padrão Conforme/Não conforme + N/A, com foto+comentário obrigatórios e
 * geração de NC quando "Não conforme"), vinculado a todo equipamento ativo daquela área.
 * Áreas sem equipamento ativo, ou que já têm o template, são puladas. Remover depois de usar.
 */
const TOKEN = "9c3e7a1f5d8b2c6e0a4f9d3b7e1c5a8f2d6b0e4c9a3f7d1b5e8c2a6f0d4b9e3c";

const QUESTION_TITLE = "Equipamento em condições de uso, sem danos ou desgaste aparente?";

function templateName(areaName: string) {
  return `Checklist de ${areaName}`;
}

async function plan() {
  const areas = await db.area.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const actor = await db.user.findFirst({ where: { role: { key: "ADMINISTRADOR" }, active: true }, orderBy: { createdAt: "asc" } });
  if (!actor) return { error: "Nenhum usuário Administrador ativo encontrado pra atribuir como autor." };

  const rows = await Promise.all(
    areas.map(async (area) => {
      const equipments = await db.equipment.findMany({
        where: { areaId: area.id, active: true },
        select: { id: true, typeId: true },
      });
      const existing = await db.checklistTemplate.findFirst({ where: { name: templateName(area.name) } });
      return {
        areaId: area.id,
        areaName: area.name,
        equipmentCount: equipments.length,
        alreadyExists: !!existing,
        willCreate: equipments.length > 0 && !existing,
      };
    }),
  );

  return { actor: { id: actor.id, name: actor.name }, areas: rows };
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

  const toCreate = info.areas.filter((a) => a.willCreate);
  const results: { areaName: string; templateId?: string; assignedCount?: number; error?: string }[] = [];

  for (const row of toCreate) {
    try {
      const equipments = await db.equipment.findMany({
        where: { areaId: row.areaId, active: true },
        select: { id: true, typeId: true },
      });
      const typeCounts = new Map<string, number>();
      for (const e of equipments) typeCounts.set(e.typeId, (typeCounts.get(e.typeId) ?? 0) + 1);
      const mostCommonTypeId = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];

      const result = await db.$transaction(async (tx) => {
        const template = await tx.checklistTemplate.create({
          data: {
            name: templateName(row.areaName),
            description: `Checklist padrão pros equipamentos da área ${row.areaName}.`,
            equipmentTypeId: mostCommonTypeId,
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

        return { templateId: template.id, assignedCount: equipments.length };
      });

      results.push({ areaName: row.areaName, ...result });
    } catch (error) {
      results.push({ areaName: row.areaName, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return NextResponse.json({ action, skipped: info.areas.filter((a) => !a.willCreate), results });
}
