"use client";

import { useRef, useState } from "react";
import { FileText, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uploadActivityDocumentAction, registerActivityDocumentAction, deleteActivityDocumentAction } from "@/server/actions/activity.actions";
import { uploadPresigned } from "@vercel/blob/client";
import { DOCUMENT_MIME_EXT, MAX_DOCUMENT_SIZE_BYTES, documentMimeType } from "@/domain/shared/document-upload";
import { SoftDeleteButton } from "@/components/domain/soft-delete-button";
import { attachmentUrl } from "@/lib/attachment-url";
import { formatDateTime } from "@/lib/dates";

type Doc = { id: string; path: string; filename: string; uploadedAt: Date; uploadedBy: { name: string } };

export function ActivityDocumentUpload({
  activityId,
  docType,
  label,
  documents,
  directUpload = false,
}: {
  directUpload?: boolean;
  activityId: string;
  docType: "POP" | "AR_VR" | "LISTA_TREINAMENTO";
  label: string;
  documents: Doc[];
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [progress, setProgress] = useState<number | null>(null);

  async function handleFileSelected(file: File) {
    const mimeType = documentMimeType(file);
    if (!mimeType) {
      toast.error("Formato não suportado. Envie PDF, Word, PowerPoint ou Excel.");
      return;
    }
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      toast.error(`Arquivo com ${(file.size / 1024 / 1024).toFixed(1)} MB. O limite é 20 MB: comprima o arquivo (ex.: reduza as imagens do PowerPoint) e tente de novo.`);
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      let result: { ok: true } | { ok: false; error: string };
      if (directUpload) {
        // Direto do navegador para o armazenamento: o arquivo não passa pelo servidor (que só aceita ~4 MB por requisição).
        const pathname = `${crypto.randomUUID()}.${DOCUMENT_MIME_EXT[mimeType]}`;
        await uploadPresigned(pathname, file, {
          access: "private",
          handleUploadUrl: "/api/uploads/token",
          contentType: mimeType,
          onUploadProgress: (e) => setProgress(Math.round(e.percentage)),
        });
        result = await registerActivityDocumentAction(activityId, docType, { pathname, filename: file.name, mimeType, size: file.size });
      } else {
        const formData = new FormData();
        formData.append("file", file);
        result = await uploadActivityDocumentAction(activityId, docType, formData);
      }
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${label} anexado.`);
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível enviar o arquivo. Verifique a conexão e tente de novo; se o arquivo for muito pesado, comprima antes.");
    } finally {
      setUploading(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">{label} {documents.length > 0 && `(${documents.length})`}</p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFileSelected(file);
          }}
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={() => inputRef.current?.click()}
          loading={uploading}
        >
          {!uploading && <Upload className="size-3.5" />}
          Adicionar
        </Button>
      </div>
      {uploading && (
        <p className="flex items-center gap-1.5 text-xs text-foreground-subtle">
          <Loader2 className="size-3.5 animate-spin" /> Enviando{progress !== null ? ` ${progress}%` : "..."}
        </p>
      )}
      {documents.length === 0 ? (
        <p className="text-sm text-foreground-subtle">Nenhum documento enviado ainda.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {documents.map((doc) => (
            <div key={doc.id} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between gap-2">
                <a
                  href={attachmentUrl(doc.path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 items-center gap-2 text-sm text-accent hover:underline"
                >
                  <FileText className="size-4 shrink-0" />
                  <span className="truncate">{doc.filename}</span>
                </a>
                <SoftDeleteButton
                  title={`Apagar "${doc.filename}"?`}
                  description="O arquivo some daqui e do QR Code público. Não dá pra desfazer — se precisar dele de novo, é só enviar outra vez."
                  ariaLabel={`Apagar ${doc.filename}`}
                  successMessage="Documento apagado."
                  onConfirm={() => deleteActivityDocumentAction(doc.id)}
                />
              </div>
              <p className="pl-6 text-xs text-foreground-subtle">
                Enviado em {formatDateTime(doc.uploadedAt)} por {doc.uploadedBy.name}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
