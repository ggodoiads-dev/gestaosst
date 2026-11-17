"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FilePlus2, FileText, Paperclip, Plus, Trash2, X } from "lucide-react";
import { formatPersonName } from "@/lib/format-name";
import { attachmentUrl } from "@/lib/attachment-url";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/label";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  attachDisciplineRecordFileAction,
  createDisciplineRecordAction,
  deleteDisciplineRecordAction,
  removeDisciplineRecordFileAction,
} from "@/server/actions/discipline-record.actions";
import { DISCIPLINE_STEPS, disciplineStepLabel } from "@/domain/discipline/ladder";

export type DisciplineRecordView = {
  id: string;
  collaboratorId: string;
  collaboratorName: string;
  dayKey: string;
  reason: string;
  description: string;
  step: string;
  createdByName: string;
  files: { id: string; filename: string; path: string; uploadedByName: string }[];
};

const dmy = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}/${key.slice(0, 4)}`;
const field = "h-9 w-full rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground";

/** Nova advertência: colaborador, data, motivo, descrição e a aplicação (medida da escada). Anexos entram depois, na própria linha. */
function NewRecordDialog({ collaborators, disabled }: { collaborators: { id: string; name: string }[]; disabled: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [collaboratorId, setCollaboratorId] = useState("");
  const [dayKey, setDayKey] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [step, setStep] = useState("");
  const [error, setError] = useState<string | null>(null);

  const valid = !!collaboratorId && !!dayKey && reason.trim().length >= 3 && description.trim().length >= 3 && !!step;

  function save() {
    setError(null);
    start(async () => {
      const res = await createDisciplineRecordAction({ collaboratorId, dayKey, reason, description, step });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Advertência registrada. Se quiser, anexe o documento na linha dela.");
      setOpen(false);
      setCollaboratorId("");
      setDayKey("");
      setReason("");
      setDescription("");
      setStep("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled}>
          <Plus className="size-4" /> Nova advertência
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova advertência</DialogTitle>
          <DialogDescription>Registro manual, fora da escada automática. Os anexos (ex.: a advertência assinada) podem ser enviados depois.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <FormField label="Colaborador" required>
            <select value={collaboratorId} onChange={(e) => setCollaboratorId(e.target.value)} className={field}>
              <option value="">Escolher…</option>
              {collaborators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormField>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Data" required>
              <Input type="date" value={dayKey} onChange={(e) => setDayKey(e.target.value)} />
            </FormField>
            <FormField label="Aplicação" required hint="Qual medida foi aplicada">
              <select value={step} onChange={(e) => setStep(e.target.value)} className={field}>
                <option value="">Escolher…</option>
                {DISCIPLINE_STEPS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField label="Motivo" required>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: Uso incorreto de EPI" maxLength={200} />
          </FormField>
          <FormField label="Descrição" required>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="O que aconteceu, onde e quando." maxLength={4000} />
          </FormField>
          {error && <p className="text-sm text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancelar
            </Button>
          </DialogClose>
          <Button onClick={save} loading={pending} disabled={!valid}>
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecordRow({ record }: { record: DisciplineRecordView }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();

  function upload(file: File) {
    start(async () => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await attachDisciplineRecordFileAction(record.id, formData);
      if (inputRef.current) inputRef.current.value = "";
      if (res.ok) {
        toast.success("Arquivo anexado.");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function removeFile(id: string) {
    if (!window.confirm("Remover este anexo?")) return;
    start(async () => {
      const res = await removeDisciplineRecordFileAction(id);
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  }

  function removeRecord() {
    if (!window.confirm("Apagar esta advertência e os anexos dela? Não dá para desfazer.")) return;
    start(async () => {
      const res = await deleteDisciplineRecordAction(record.id);
      if (res.ok) {
        toast.success("Advertência apagada.");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="danger">{disciplineStepLabel(record.step)}</Badge>
        <span className="text-xs tabular-nums text-foreground-subtle">{dmy(record.dayKey)}</span>
        <Link href={`/colaboradores/${record.collaboratorId}`} className="text-sm font-semibold text-foreground hover:underline">
          {formatPersonName(record.collaboratorName)}
        </Link>
        <span className="ml-auto flex items-center gap-1">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          <Button size="sm" variant="secondary" loading={pending} onClick={() => inputRef.current?.click()}>
            <Paperclip className="size-4" /> Anexar
          </Button>
          <Button size="icon" variant="ghost" aria-label="Apagar advertência" disabled={pending} onClick={removeRecord}>
            <Trash2 className="size-4 text-danger" />
          </Button>
        </span>
      </div>
      <p className="text-sm font-medium text-foreground">{record.reason}</p>
      <p className="whitespace-pre-wrap text-sm text-foreground-muted">{record.description}</p>
      {record.files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {record.files.map((f) => (
            <li key={f.id} className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs">
              <FileText className="size-3.5 text-foreground-subtle" />
              <a href={attachmentUrl(f.path)} target="_blank" rel="noopener noreferrer" className="max-w-56 truncate text-accent hover:underline" title={`Enviado por ${f.uploadedByName}`}>
                {f.filename}
              </a>
              <button type="button" aria-label="Remover anexo" className="text-foreground-subtle hover:text-danger" onClick={() => removeFile(f.id)}>
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-foreground-subtle">Registrada por {record.createdByName}</p>
    </div>
  );
}

export function DisciplineRecordsSection({ records, collaborators, ready }: { records: DisciplineRecordView[]; collaborators: { id: string; name: string }[]; ready: boolean }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <FilePlus2 className="size-4" /> Advertências registradas ({records.length})
          </h2>
          <p className="text-xs text-foreground-subtle">Registro manual: colaborador, data, motivo, descrição e a aplicação. O anexo pode vir depois.</p>
        </div>
        <NewRecordDialog collaborators={collaborators} disabled={!ready} />
      </div>
      {!ready && (
        <div className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
          A atualização do banco de dados das advertências ainda não foi aplicada, então não dá para registrar por enquanto.
        </div>
      )}
      {records.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong bg-surface px-4 py-6 text-center text-sm text-foreground-subtle">Nenhuma advertência registrada ainda.</div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
          {records.map((r) => (
            <RecordRow key={r.id} record={r} />
          ))}
        </div>
      )}
    </section>
  );
}
