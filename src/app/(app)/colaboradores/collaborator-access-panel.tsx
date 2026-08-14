"use client";

import { useState, useTransition } from "react";
import { KeyRound, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  provisionCollaboratorAccessAction,
  resetCollaboratorAccessPasswordAction,
} from "@/server/actions/collaborator.actions";
import { CredentialsRevealDialog } from "./credentials-reveal-dialog";

export function CollaboratorAccessPanel({
  collaboratorId,
  checklistEnabled,
  userEmail,
}: {
  collaboratorId: string;
  checklistEnabled: boolean;
  userEmail: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

  if (!checklistEnabled) return null;

  function handleProvision() {
    startTransition(async () => {
      const result = await provisionCollaboratorAccessAction(collaboratorId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCredentials({ email: result.email, password: result.password });
    });
  }

  function handleReset() {
    startTransition(async () => {
      const result = await resetCollaboratorAccessPasswordAction(collaboratorId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCredentials({ email: result.email, password: result.password });
    });
  }

  return (
    <>
      <div className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2.5 text-sm">
        {userEmail ? (
          <>
            <Badge tone="success">Login: {userEmail}</Badge>
            <Button size="sm" variant="secondary" onClick={handleReset} loading={isPending}>
              <RotateCcw className="size-3.5" /> Redefinir senha
            </Button>
          </>
        ) : (
          <>
            <span className="text-foreground-subtle">Faz checklist, mas ainda sem acesso ao sistema.</span>
            <Button size="sm" onClick={handleProvision} loading={isPending} className="ml-auto">
              <KeyRound className="size-3.5" /> Criar acesso ao sistema
            </Button>
          </>
        )}
      </div>

      {credentials && (
        <CredentialsRevealDialog
          email={credentials.email}
          password={credentials.password}
          onClose={() => setCredentials(null)}
        />
      )}
    </>
  );
}
