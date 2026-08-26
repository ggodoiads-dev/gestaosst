import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { put, get } from "@vercel/blob";

const STORAGE_DRIVER = process.env.STORAGE_DRIVER ?? "local";
const STORAGE_DIR = process.env.STORAGE_DIR ?? "./storage/uploads";

export class InvalidUploadError extends Error {}

type UploadResult = {
  filename: string;
  path: string;
  mimeType: string;
  size: number;
};

type UploadOptions = {
  allowedMimeTypes: Record<string, string>; // mimeType -> extensão de arquivo
  maxSizeBytes: number;
  invalidTypeMessage: string;
  invalidSizeMessage: string;
};

/**
 * Salva um arquivo enviado, validando formato e tamanho (seção 41 do documento). Em
 * desenvolvimento (`STORAGE_DRIVER=local`, padrão) grava em disco; em produção
 * (`STORAGE_DRIVER=blob`) grava no Vercel Blob como objeto privado — só acessível
 * através da rota autenticada `/api/uploads/[...path]`, nunca por URL pública direta.
 */
async function saveFileUpload(file: File, options: UploadOptions): Promise<UploadResult> {
  const ext = options.allowedMimeTypes[file.type];
  if (!ext) {
    throw new InvalidUploadError(options.invalidTypeMessage);
  }
  if (file.size > options.maxSizeBytes) {
    throw new InvalidUploadError(options.invalidSizeMessage);
  }

  const filename = `${randomUUID()}.${ext}`;
  const relativePath = `uploads/${filename}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  if (STORAGE_DRIVER === "blob") {
    // Pathname no Blob é só o filename (sem o prefixo "uploads/"), pra bater com os
    // segmentos que a rota `/api/uploads/[...path]` recebe — "uploads/" já é o
    // segmento literal da própria rota, não faz parte do catch-all.
    await put(filename, buffer, { access: "private", contentType: file.type });
  } else {
    // turbopackIgnore: caminho de storage local configurável em runtime (fora do bundle de build)
    const dir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), STORAGE_DIR);
    await mkdir(dir, { recursive: true });
    const fullPath = path.join(/*turbopackIgnore: true*/ dir, filename);
    await writeFile(fullPath, buffer);
  }

  return {
    filename: file.name || filename,
    path: relativePath,
    mimeType: file.type,
    size: file.size,
  };
}

/**
 * Lê os bytes de um anexo já salvo, independente do driver ativo — usado pelo
 * Copiloto de Inspeção (`ai-vision.service.ts`) para enviar a foto pra análise.
 * Recebe o mesmo `path` gravado em `Attachment.path` (ex: "uploads/<arquivo>").
 */
export async function readFileBuffer(attachmentPath: string): Promise<Buffer> {
  const filename = attachmentPath.replace(/^uploads\//, "");

  if (STORAGE_DRIVER === "blob") {
    const result = await get(filename, { access: "private" });
    if (!result) throw new Error(`Anexo não encontrado no Blob: ${filename}`);
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  }

  // turbopackIgnore: caminho de storage local configurável em runtime (fora do bundle de build)
  const dir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), STORAGE_DIR);
  return readFile(path.join(/*turbopackIgnore: true*/ dir, filename));
}

const IMAGE_MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "jpg",
};
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB

export function savePhotoUpload(file: File): Promise<UploadResult> {
  return saveFileUpload(file, {
    allowedMimeTypes: IMAGE_MIME_EXT,
    maxSizeBytes: MAX_IMAGE_SIZE_BYTES,
    invalidTypeMessage: "Formato de imagem não suportado. Envie JPEG, PNG, WEBP ou HEIC.",
    invalidSizeMessage: "Arquivo maior que o limite de 8MB.",
  });
}

const DOCUMENT_MIME_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};
const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

/** Salva documentos (POP, AR/VR, certificados) — PDF, Word, PowerPoint ou Excel. */
export function saveDocumentUpload(file: File): Promise<UploadResult> {
  return saveFileUpload(file, {
    allowedMimeTypes: DOCUMENT_MIME_EXT,
    maxSizeBytes: MAX_DOCUMENT_SIZE_BYTES,
    invalidTypeMessage: "Formato de documento não suportado. Envie PDF, Word, PowerPoint ou Excel.",
    invalidSizeMessage: "Arquivo maior que o limite de 20MB.",
  });
}

const ATTACHMENT_MIME_EXT: Record<string, string> = { ...IMAGE_MIME_EXT, ...DOCUMENT_MIME_EXT };
const MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

/** Salva qualquer anexo geral (foto ou documento) — usado em acidentes, advertências, observações de escala. */
export function saveAttachmentUpload(file: File): Promise<UploadResult> {
  return saveFileUpload(file, {
    allowedMimeTypes: ATTACHMENT_MIME_EXT,
    maxSizeBytes: MAX_ATTACHMENT_SIZE_BYTES,
    invalidTypeMessage: "Formato não suportado. Envie uma imagem, PDF, Word ou PowerPoint.",
    invalidSizeMessage: "Arquivo maior que o limite de 20MB.",
  });
}
