import { NextResponse } from "next/server";
import { getCurrentUser, ForbiddenError } from "@/server/auth/current-user";
import { getMeasurePreview } from "@/server/services/discipline.service";
import { buildMeasureDocx } from "@/server/services/discipline-docx";
import { stepHasDocument } from "@/domain/discipline/document";
import { formatDate } from "@/lib/dates";
import type { DisciplineReasonKey, DisciplineStepKey } from "@/domain/discipline/ladder";

/** Documento da medida ANTES de registrá-la (prévia para imprimir e assinar). Não grava nada. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const q = new URL(request.url).searchParams;
  const input = {
    reason: q.get("reason") ?? "",
    collaboratorId: q.get("collaboratorId") ?? "",
    dayKey: q.get("dayKey") ?? "",
    step: q.get("step") ?? "",
    note: (q.get("note") ?? "").slice(0, 1000),
  };
  let preview;
  try {
    preview = await getMeasurePreview(user, input);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    if (error instanceof Error) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
  if (!preview || !stepHasDocument(input.step)) return NextResponse.json({ error: "Esta medida não gera documento." }, { status: 404 });

  const [y, m, d] = input.dayKey.split("-").map(Number);
  const buffer = await buildMeasureDocx({
    step: input.step as DisciplineStepKey,
    reason: input.reason as DisciplineReasonKey,
    collaborator: {
      name: preview.collaborator.name,
      matricula: preview.collaborator.matricula,
      functionName: preview.collaborator.function?.name ?? null,
      areaName: preview.collaborator.area?.name ?? null,
    },
    occurrenceDate: formatDate(new Date(Date.UTC(y, m - 1, d, 12))),
    sequence: preview.sequence,
    note: input.note.trim() || null,
    issuedAt: formatDate(new Date()),
  });
  const safeName = preview.collaborator.name.replace(/[^\p{L}\p{N}]+/gu, "_");
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="previa_${input.step}_${safeName}_${input.dayKey}.docx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
