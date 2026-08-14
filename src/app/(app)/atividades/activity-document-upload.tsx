"use client";

import { useRef, useState } from "react";
import { FileText, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uploadActivityDocumentAction } from "@/server/actions/activity.actions";
import { attachmentUrl } from "@/lib/attachment-url";
import { formatDateTime } from "@/lib/dates";

type CurrentDoc = { path: string; filename: string; uploadedAt: Date; uploadedBy: { name: string } } | null;

export function ActivityDocumentUpload({
  activityId,
  docType,
  label,
  current,
}: {
  activityId: string;
  docType: "POP" | "AR_VR" | "LISTA_TREINAMENTO";
  label: string;
  current: CurrentDoc;
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
    toast.success(`${label} atualizado.`);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
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
          {current ? "Substituir" : "Enviar"}
        </Button>
      </div>
      {uploading && (
        <p className="flex items-center gap-1.5 text-xs text-foreground-subtle">
          <Loader2 className="size-3.5 animate-spin" /> Enviando...
        </p>
      )}
      {current ? (
        <a
          href={attachmentUrl(current.path)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-accent hover:underline"
        >
          <FileText className="size-4 shrink-0" />
          <span className="truncate">{current.filename}</span>
        </a>
      ) : (
        <p className="text-sm text-foreground-subtle">Nenhum documento enviado ainda.</p>
      )}
      {current && (
        <p className="text-xs text-foreground-subtle">
          Enviado em {formatDateTime(current.uploadedAt)} por {current.uploadedBy.name}
        </p>
      )}
    </div>
  );
}
