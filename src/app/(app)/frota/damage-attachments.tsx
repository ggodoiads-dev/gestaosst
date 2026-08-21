"use client";

import { useRef, useState } from "react";
import { FileText, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uploadEquipmentDamageAttachmentAction } from "@/server/actions/equipment-damage.actions";
import { attachmentUrl } from "@/lib/attachment-url";
import { formatDateTime } from "@/lib/dates";

type AttachmentItem = {
  id: string;
  filename: string;
  path: string;
  uploadedAt: Date;
  uploadedBy: { name: string };
};

export function DamageAttachments({ damageId, attachments }: { damageId: string; attachments: AttachmentItem[] }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelected(file: File) {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const result = await uploadEquipmentDamageAttachmentAction(damageId, formData);
    setUploading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Arquivo anexado.");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-2.5">
      {attachments.length === 0 && (
        <p className="text-sm text-foreground-subtle">Nenhuma evidência anexada ainda — fotos do dano, orçamento, etc.</p>
      )}
      {attachments.map((att) => (
        <a
          key={att.id}
          href={attachmentUrl(att.path)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2 text-sm hover:border-border-strong"
        >
          <FileText className="size-4 shrink-0 text-foreground-subtle" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-accent">{att.filename}</p>
            <p className="text-xs text-foreground-subtle">
              {formatDateTime(att.uploadedAt)} · {att.uploadedBy.name}
            </p>
          </div>
        </a>
      ))}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFileSelected(file);
        }}
      />
      <Button size="sm" variant="secondary" className="self-start" onClick={() => inputRef.current?.click()} loading={uploading}>
        {!uploading && <Upload className="size-3.5" />}
        Anexar evidência
      </Button>
      {uploading && (
        <p className="flex items-center gap-1.5 text-xs text-foreground-subtle">
          <Loader2 className="size-3.5 animate-spin" /> Enviando...
        </p>
      )}
    </div>
  );
}
