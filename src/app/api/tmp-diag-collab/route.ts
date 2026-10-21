import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { diagnoseChecklistDays, listChecklistNonCompletion } from "@/server/services/checklist-compliance.service";
import { DISCIPLINE_START_KEY } from "@/domain/discipline/ladder";

const TOKEN_SHA256 = "b8b70534de4c9057da0acb315945121ab51f9afaef93fa7a21f40b8263c0967c";

// Diagnóstico SOMENTE LEITURA: por que um colaborador aparece (ou não) nas medidas de checklist. Não grava nada.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const given = Buffer.from(createHash("sha256").update(token).digest("hex"));
  const expected = Buffer.from(TOKEN_SHA256);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const name = url.searchParams.get("nome") ?? "tanahan";
  const c = await db.collaborator.findFirst({
    where: { name: { contains: name, mode: "insensitive" } },
    select: {
      id: true, name: true, active: true, checklistEnabled: true, requiresChecklist: true, userId: true,
      area: { select: { name: true } }, turno: { select: { name: true } },
      function: { select: { name: true, requiredChecklists: { select: { templateId: true } } } },
    },
  });
  if (!c) return NextResponse.json({ error: "colaborador não encontrado" }, { status: 404 });
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth(), to.getDate() - 6);
  const [days, infractions, measures] = await Promise.all([
    diagnoseChecklistDays(c.id, from, to),
    listChecklistNonCompletion(DISCIPLINE_START_KEY),
    db.disciplinaryMeasure.findMany({ where: { collaboratorId: c.id }, select: { reason: true, referenceDate: true, step: true, status: true } }).catch(() => "tabela indisponível"),
  ]);
  return NextResponse.json({
    agoraServidor: new Date().toISOString(),
    colaborador: { ...c, temLogin: !!c.userId, userId: undefined, funcaoChecklists: c.function?.requiredChecklists.length ?? 0 },
    inicioDasMedidas: DISCIPLINE_START_KEY,
    dias: days.days,
    ocorrenciasDeleNaListaDeMedidas: infractions.filter((i) => i.collaboratorId === c.id),
    medidasJaRegistradas: measures,
  });
}
