"use client";

import { useState, useTransition } from "react";
import { Users } from "lucide-react";
import { toast } from "sonner";
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
import { provisionAllCollaboratorsAccessAction } from "@/server/actions/collaborator.actions";

export function BulkAccessButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ created: { name: string; email: string }[]; alreadyLinked: number } | null>(
    null,
  );

  function handleClick() {
    startTransition(async () => {
      const response = await provisionAllCollaboratorsAccessAction();
      if (!response.ok) {
        toast.error(response.error);
        return;
      }
      setResult({ created: response.created, alreadyLinked: response.alreadyLinked });
    });
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={handleClick} loading={isPending}>
        <Users className="size-3.5" /> Criar acesso para todos
      </Button>

      {result && (
        <Dialog open onOpenChange={(o) => !o && setResult(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Acessos criados</DialogTitle>
              <DialogDescription>
                {result.created.length} conta(s) nova(s) — senha padrão para todas:{" "}
                <code className="font-mono font-semibold">12345678</code>.
                {result.alreadyLinked > 0 && ` ${result.alreadyLinked} colaborador(es) já tinham acesso.`}
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              {result.created.length > 0 ? (
                <div className="max-h-80 overflow-y-auto rounded-md border border-border-strong">
                  <table className="w-full text-sm">
                    <tbody>
                      {result.created.map((c) => (
                        <tr key={c.email} className="border-b border-border last:border-0">
                          <td className="px-3 py-2 text-foreground">{c.name}</td>
                          <td className="px-3 py-2 font-mono text-foreground-subtle">{c.email}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-foreground-subtle">Todos os colaboradores ativos já têm acesso.</p>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" onClick={() => setResult(null)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
