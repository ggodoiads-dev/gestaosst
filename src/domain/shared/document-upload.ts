/**
 * Documentos (POP, AR/VR, lista de treinamento...). O envio da própria tela vai DIRETO do navegador para o armazenamento (Vercel Blob): passar o arquivo pelo
 * servidor esbarra no limite de ~4,5 MB de corpo de requisição da Vercel, e um POP em PowerPoint/PDF costuma ser bem maior que isso.
 */
export const DOCUMENT_MIME_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};
export const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

/** Nome do arquivo no armazenamento: UUID + extensão do tipo aceito (nunca o nome que o usuário deu). */
export const DOCUMENT_BLOB_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|doc|docx|ppt|pptx|xls|xlsx)$/;

/** Alguns navegadores/Windows não informam o tipo de .pptx/.docx: deduz pelo nome do arquivo. */
export function documentMimeType(file: { name: string; type: string }): string | null {
  if (DOCUMENT_MIME_EXT[file.type]) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return Object.entries(DOCUMENT_MIME_EXT).find(([, e]) => e === ext)?.[0] ?? null;
}
