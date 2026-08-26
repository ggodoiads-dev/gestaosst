import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { readFileBuffer } from "@/server/services/storage";

/** Público (sem login), tirando o nome da rota antiga `certificado` — passou a servir tanto
 * certificado de qualificação quanto documento de área (POP/AR-VR), então generalizei em vez de
 * duplicar a rota. Usada nas fichas de QR Code em `/q/[token]`, vistas sem sessão (quem escaneia
 * o QR físico não tem como logar antes). Só serve anexo com contexto QUALIFICACAO ou AREA, mesmo
 * que alguém tente adivinhar o ID de um anexo de outro tipo (acidente, avaria etc.) — o resto do
 * sistema de anexos continua exigindo login normalmente. */
const PUBLIC_CONTEXTS = ["QUALIFICACAO", "AREA"] as const;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const attachment = await db.attachment.findUnique({ where: { id } });
  if (!attachment || !PUBLIC_CONTEXTS.includes(attachment.context as (typeof PUBLIC_CONTEXTS)[number])) {
    return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }

  try {
    const buffer = await readFileBuffer(attachment.path);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.filename)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }
}
