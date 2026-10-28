import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentUser, hasPermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { DOCUMENT_BLOB_NAME, DOCUMENT_MIME_EXT, MAX_DOCUMENT_SIZE_BYTES } from "@/domain/shared/document-upload";

/**
 * Autoriza o envio direto de um documento de atividade (POP, AR/VR, lista de treinamento) do navegador para o armazenamento. Só quem gerencia atividades
 * recebe o token, só para um nome de arquivo no padrão (UUID + extensão), só dos formatos aceitos e até 20 MB. O vínculo com a atividade é feito depois,
 * pela action `registerActivityDocumentAction`.
 */
export async function POST(request: Request) {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const user = await getCurrentUser();
        if (!user || !hasPermission(user, PERMISSIONS.ACTIVITY_MANAGE)) throw new Error("Sem permissão para enviar documentos de atividade.");
        if (!DOCUMENT_BLOB_NAME.test(pathname)) throw new Error("Nome de arquivo inválido.");
        return {
          allowedContentTypes: Object.keys(DOCUMENT_MIME_EXT),
          maximumSizeInBytes: MAX_DOCUMENT_SIZE_BYTES,
          addRandomSuffix: false,
          allowOverwrite: false,
        };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[upload-token]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível autorizar o envio." }, { status: 400 });
  }
}
