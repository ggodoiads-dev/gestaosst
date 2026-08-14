"use client";

import { useState } from "react";
import { Copy, Check, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-foreground-subtle">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded-md border border-border-strong bg-surface-muted px-3 py-2 text-sm font-mono">
          {value}
        </code>
        <Button type="button" size="icon" variant="secondary" onClick={handleCopy} aria-label={`Copiar ${label}`}>
          {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

export function CredentialsRevealDialog({
  email,
  password,
  onClose,
}: {
  email: string;
  password: string;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4" /> Acesso criado
          </DialogTitle>
          <DialogDescription>
            Anote ou copie agora — a senha não pode ser vista de novo depois de fechar esta janela.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <CopyField label="E-mail de login" value={email} />
          <CopyField label="Senha" value={password} />
        </DialogBody>
        <DialogFooter>
          <Button type="button" onClick={onClose}>Já anotei, fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
