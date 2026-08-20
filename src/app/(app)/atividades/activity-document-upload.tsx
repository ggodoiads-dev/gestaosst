"use client";

import { useRef, useState } from "react";
import { FileText, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uploadActivityDocumentAction } from "@/server/actions/activity.actions";
import { attachmentUrl } from "@/lib/attachment-url";
import { formatDateTime } from "@/lib/dates";

type Doc = { id: string; path: string; filename: string; uploadedAt: Date; uploadedBy: { name: string } };

export function ActivityDocumentUpload({
  activityId,
  docType,
  label,
  documents,
}: {
  activityId: string;
  docType: "POP" | "AR_VR" | "LISTA_TREINAMENTO";
  label: string;
  documents: Doc[];
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelected(file: File) {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const result = await uploadActivityDocumentAction(activityId, docType, formData);
    setUploading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${label} anexado.`);
    if (inputRef.current) inputRef.current.value = "";
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
          <Loader2 className="size-3.5 animate-spin" /> Enviando...
        </p>
      )}
      {documents.length === 0 ? (
        <p className="text-sm text-foreground-subtle">Nenhum documento enviado ainda.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {documents.map((doc) => (
            <div key={doc.id} className="flex flex-col gap-0.5">
              <a
                href={attachmentUrl(doc.path)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-accent hover:underline"
              >
                <FileText className="size-4 shrink-0" />
                <span className="truncate">{doc.filename}</span>
              </a>
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
