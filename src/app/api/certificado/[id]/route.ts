import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { readFileBuffer } from "@/server/services/storage";

/** Rota pública (sem login) só pra servir certificado de qualificação (PDF/foto) — usada nas
 * fichas de QR Code em `/q/[token]`, que também são vistas sem sessão (quem escaneia o QR físico
 * da área não tem como logar antes de conferir a NR de alguém). Só serve anexo com
 * `context = "QUALIFICACAO"`, mesmo que alguém tente adivinhar o ID de um anexo de outro tipo
 * (acidente, avaria etc.) — o resto do sistema de anexos continua exigindo login normalmente. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const attachment = await db.attachment.findUnique({ where: { id } });
  if (!attachment || attachment.context !== "QUALIFICACAO") {
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
