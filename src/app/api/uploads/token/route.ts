import { NextResponse } from "next/server";
import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { getCurrentUser, hasPermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { DOCUMENT_BLOB_NAME, DOCUMENT_MIME_EXT, MAX_DOCUMENT_SIZE_BYTES } from "@/domain/shared/document-upload";

/**
 * Autoriza o envio direto de um documento de atividade (POP, AR/VR, lista de treinamento) do navegador para o armazenamento. O armazenamento do projeto
 * usa a autenticação da própria Vercel (BLOB_STORE_ID, sem chave de leitura e escrita), então o envio é por URL assinada. Só quem gerencia atividades
 * recebe a autorização, só para um nome de arquivo no padrão (UUID + extensão), só dos formatos aceitos e até 20 MB. O vínculo com a atividade é
 * feito depois, pela action `registerActivityDocumentAction`.
 */
export async function POST(request: Request) {
  let body: HandleUploadPresignedBody;
  try {
    body = (await request.json()) as HandleUploadPresignedBody;
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  try {
    const result = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname) => {
        const user = await getCurrentUser();
        if (!user || !hasPermission(user, PERMISSIONS.ACTIVITY_MANAGE)) throw new Error("Sem permissão para enviar documentos de atividade.");
        if (!DOCUMENT_BLOB_NAME.test(pathname)) throw new Error("Nome de arquivo inválido.");
        const allowedContentTypes = Object.keys(DOCUMENT_MIME_EXT);
        const token = await issueSignedToken({ pathname, operations: ["put"], allowedContentTypes, maximumSizeInBytes: MAX_DOCUMENT_SIZE_BYTES });
        return { token, urlOptions: { allowedContentTypes, maximumSizeInBytes: MAX_DOCUMENT_SIZE_BYTES, addRandomSuffix: false, allowOverwrite: false } };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[upload-token]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível autorizar o envio." }, { status: 400 });
  }
}
