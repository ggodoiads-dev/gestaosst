"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteDpvimAction } from "@/server/actions/dpvim.actions";

/** Exclui a DPVIM de vez (cadastro de teste ou errado): some do histórico, com as atividades e as fotos. */
export function DeleteDpvimButton({ id, code }: { id: string; code: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function run() {
    if (!window.confirm(`Excluir ${code} de vez? As atividades e as fotos dela também são apagadas e não dá para desfazer.`)) return;
    start(async () => {
      const res = await deleteDpvimAction(id);
      if (res.ok) {
        toast.success(`${code} excluída.`);
        router.push("/dpvim");
        router.refresh();
      } else toast.error(res.error);
    });
  }
  return (
    <Button size="sm" variant="outlineDanger" loading={pending} onClick={run}>
      <Trash2 className="size-4" /> Excluir
    </Button>
  );
}
