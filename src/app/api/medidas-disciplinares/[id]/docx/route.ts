import { NextResponse } from "next/server";
import { getCurrentUser, ForbiddenError } from "@/server/auth/current-user";
import { getMeasureForDocument } from "@/server/services/discipline.service";
import { buildMeasureDocx } from "@/server/services/discipline-docx";
import { stepHasDocument } from "@/domain/discipline/document";
import { formatDate } from "@/lib/dates";
import type { DisciplineReasonKey, DisciplineStepKey } from "@/domain/discipline/ladder";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  let loaded;
  try {
    loaded = await getMeasureForDocument(user, id);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    throw error;
  }
  if (!loaded || !stepHasDocument(loaded.measure.step)) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });

  const { measure, sequence } = loaded;
  const buffer = await buildMeasureDocx({
    step: measure.step as DisciplineStepKey,
    reason: measure.reason as DisciplineReasonKey,
    collaborator: {
      name: measure.collaborator.name,
      matricula: measure.collaborator.matricula,
      functionName: measure.collaborator.function?.name ?? null,
      areaName: measure.collaborator.area?.name ?? null,
    },
    occurrenceDate: formatDate(measure.referenceDate),
    sequence,
    note: measure.note,
    issuedAt: formatDate(measure.decidedAt),
  });
  const safeName = measure.collaborator.name.replace(/[^\p{L}\p{N}]+/gu, "_");
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="medida-disciplinar_${measure.step}_${safeName}_${measure.referenceDate.toISOString().slice(0, 10)}.docx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
