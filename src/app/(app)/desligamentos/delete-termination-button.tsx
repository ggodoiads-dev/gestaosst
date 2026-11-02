"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteTerminationAction } from "@/server/actions/termination.actions";

/** Remove um desligamento importado por engano (a planilha pode ser importada de novo). */
export function DeleteTerminationButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function remove() {
    if (!window.confirm(`Excluir o desligamento de ${name}? Reimportar a planilha traz de volta.`)) return;
    start(async () => {
      const res = await deleteTerminationAction(id);
      if (res.ok) {
        toast.success("Desligamento excluído.");
        router.refresh();
      } else toast.error(res.error);
    });
  }
  return (
    <Button size="icon" variant="ghost" onClick={remove} loading={pending} aria-label={`Excluir o desligamento de ${name}`}>
      <Trash2 className="size-4" />
    </Button>
  );
}
