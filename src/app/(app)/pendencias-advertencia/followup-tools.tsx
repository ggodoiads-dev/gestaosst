"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Paperclip, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { attachmentUrl } from "@/lib/attachment-url";
import {
  attachWarningDocumentAction,
  deleteAbsenceNoteAction,
  removeWarningDocumentAction,
} from "@/server/actions/absence-followup.actions";

export function WarningDocuments({
  noteId,
  attachments,
  canAttach,
}: {
  noteId: string;
  attachments: { id: string; filename: string; path: string }[];
  canAttach: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function upload(file: File) {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await attachWarningDocumentAction(noteId, formData);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Documento anexado. A advertência foi marcada como aplicada e o colaborador já consegue ver.");
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await removeWarningDocumentAction(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {attachments.length > 0 && (
        <ul className="flex flex-col gap-1">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded-md bg-surface-muted px-2.5 py-1.5 text-xs">
              <a href={attachmentUrl(a.path)} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1.5 text-accent hover:underline">
                <FileText className="size-3.5 shrink-0" />
                <span className="truncate">{a.filename}</span>
              </a>
              {canAttach && (
                <button
                  type="button"
                  onClick={() => remove(a.id)}
                  disabled={pending}
                  aria-label={`Remover ${a.filename}`}
                  className="shrink-0 text-foreground-subtle hover:text-danger"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canAttach && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
              e.target.value = "";
            }}
          />
          <div>
            <Button size="sm" variant="secondary" loading={pending} onClick={() => inputRef.current?.click()}>
              <Paperclip className="size-4" /> {attachments.length > 0 ? "Anexar outro documento" : "Anexar advertência"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export function DeleteNoteButton({ noteId, label }: { noteId: string; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const res = await deleteAbsenceNoteAction(noteId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Lançamento excluído.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-foreground-subtle hover:text-danger"
      >
        <Trash2 className="size-3.5" /> Excluir lançamento
      </button>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Excluir este lançamento?</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-2 text-sm">
          <p className="font-medium text-foreground">{label}</p>
          <p className="text-foreground-subtle">
            Use quando a falta ou o atestado foi lançado por engano. O lançamento sai da escala, da presença e desta fila, e
            o dia volta ao que a escala do colaborador determina. Os anexos e a entrevista de ABS dele também são apagados.
            Não dá para desfazer.
          </p>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancelar
            </Button>
          </DialogClose>
          <Button onClick={confirm} loading={pending} variant="danger">
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
