"use client";

import { useRef, useState } from "react";
import { FileText, Upload, Loader2, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { uploadAreaDocumentAction } from "@/server/actions/masterdata.actions";
import { attachmentUrl } from "@/lib/attachment-url";
import { formatDateTime } from "@/lib/dates";

type Doc = { id: string; path: string; filename: string; uploadedAt: Date; uploadedBy: { name: string } };

const ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function AreaDocumentUpload({
  areaId,
  docType,
  label,
  documents,
}: {
  areaId: string;
  docType: "POP" | "AR_VR";
  label: string;
  documents: Doc[];
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelected(file: File) {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const result = await uploadAreaDocumentAction(areaId, docType, formData);
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
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFileSelected(file);
          }}
        />
        <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()} loading={uploading}>
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

export function AreaDocumentsDialog({
  areaId,
  areaName,
  pop,
  arVr,
}: {
  areaId: string;
  areaName: string;
  pop: Doc[];
  arVr: Doc[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} aria-label={`Documentos de ${areaName}`}>
        <FolderOpen className="size-3.5" /> Documentos
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Documentos — {areaName}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <p className="text-sm text-foreground-subtle">
            PDF, Word ou Excel. Aparecem também no QR Code público da área, pra quem trabalha ou fiscaliza ali consultar sem precisar logar.
          </p>
          <AreaDocumentUpload areaId={areaId} docType="POP" label="Procedimento (POP)" documents={pop} />
          <AreaDocumentUpload areaId={areaId} docType="AR_VR" label="Avaliação de Risco" documents={arVr} />
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Fechar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
