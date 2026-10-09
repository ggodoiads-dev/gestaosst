import { NextResponse } from "next/server";
import { getCurrentUser, ForbiddenError } from "@/server/auth/current-user";
import { getInterviewForUser } from "@/server/services/absence-interview.service";
import { buildInterviewDocx } from "@/server/services/absence-interview-docx";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  let loaded;
  try {
    loaded = await getInterviewForUser(user, id);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    throw error;
  }
  if (!loaded) return NextResponse.json({ error: "Entrevista não encontrada." }, { status: 404 });

  const buffer = await buildInterviewDocx(loaded.interview);
  const safeName = loaded.interview.collaborator.name.replace(/[^\p{L}\p{N}]+/gu, "_");
  const day = loaded.interview.note.date.toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="entrevista-abs_${safeName}_${day}.docx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
