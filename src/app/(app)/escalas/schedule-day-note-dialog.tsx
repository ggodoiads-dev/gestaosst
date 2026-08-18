"use client";

import { useActionState, useState, useTransition } from "react";
import { FileText, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  saveScheduleDayNoteAction,
  deleteScheduleDayNoteAction,
  type ActionResult,
} from "@/server/actions/schedule.actions";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { parseDateOnly, formatDate } from "@/lib/dates";
import { attachmentUrl } from "@/lib/attachment-url";

const initialState: ActionResult = { ok: true };

const OVERRIDE_OPTIONS = [
  { value: "TRABALHO", label: "Trabalhou" },
  { value: "FOLGA", label: "Não trabalhou / folga" },
];

const STATUS_OPTIONS = [
  { value: "none", label: "Sem categoria" },
  { value: "FALTA", label: "Falta" },
  { value: "ATESTADO", label: "Atestado" },
  { value: "FERIAS", label: "Férias" },
  { value: "TROCA", label: "Troca de turno" },
  { value: "BH_MAIS", label: "BH+" },
  { value: "OUTRO", label: "Outro" },
];

export function ScheduleDayNoteDialog({
  collaboratorId,
  collaboratorName,
  date,
  computed,
  note,
  onClose,
}: {
  collaboratorId: string;
  collaboratorName: string;
  date: string;
  computed: "TRABALHO" | "FOLGA";
  note: {
    id: string;
    status: string | null;
    notes: string;
    overrideStatus?: string;
    attachments?: { id: string; filename: string; path: string }[];
  } | null;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveScheduleDayNoteAction, initialState);
  useCloseOnSuccess(pending, state, onClose);
  const [overrideStatus, setOverrideStatus] = useState(note?.overrideStatus ?? computed);
  const [status, setStatus] = useState(note?.status ?? "none");
  const [isDeleting, startDelete] = useTransition();

  function handleDelete() {
    if (!note) return;
    startDelete(async () => {
      await deleteScheduleDayNoteAction(note.id);
      toast.success("Observação removida.");
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{collaboratorName}</DialogTitle>
          <DialogDescription>{formatDate(parseDateOnly(date))}</DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="collaboratorId" value={collaboratorId} />
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="overrideStatus" value={overrideStatus} />
          <input type="hidden" name="status" value={status === "none" ? "" : status} />
          <DialogBody className="flex flex-col gap-4">
            <FormField label="Situação do dia" required>
              <Select value={overrideStatus} onValueChange={setOverrideStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OVERRIDE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Categoria" hint="Opcional">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Observação" htmlFor="notes" required>
              <Textarea id="notes" name="notes" rows={3} required defaultValue={note?.notes ?? ""} placeholder="Ex: cobriu o turno da tarde, atestado médico de 2 dias..." />
            </FormField>
            <FormField label="Anexo" htmlFor="file" hint="Opcional — ex: foto ou PDF do atestado">
              <Input id="file" name="file" type="file" accept="image/*,.pdf,.doc,.docx,.ppt,.pptx" />
            </FormField>
            {note?.attachments && note.attachments.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="flex items-center gap-1.5 text-xs font-medium text-foreground-muted">
                  <Paperclip className="size-3.5" /> Anexos
                </p>
                {note.attachments.map((a) => (
                  <a
                    key={a.id}
                    href={attachmentUrl(a.path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-accent hover:underline"
                  >
                    <FileText className="size-4 shrink-0" />
                    <span className="truncate">{a.filename}</span>
                  </a>
                ))}
              </div>
            )}
            {!state.ok && <p className="text-sm text-danger">{state.error}</p>}
          </DialogBody>
          <DialogFooter>
            {note && (
              <Button type="button" variant="outlineDanger" className="mr-auto" onClick={handleDelete} loading={isDeleting}>
                Remover
              </Button>
            )}
            <DialogClose asChild>
              <Button type="button" variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button type="submit" loading={pending}>Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
