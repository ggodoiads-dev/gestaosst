"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelAccidentsAction } from "@/server/actions/accident.actions";

/**
 * Seleção em lote da lista de acidentes: as caixas de cada linha são inputs `accidentIds` (marcados/desmarcados direto no DOM, a lista é server-rendered).
 * Serve para limpar de uma vez o que entrou errado numa importação. O cancelamento é lógico: dá para reativar na aba Cancelados.
 */
export function BulkCancelToolbar() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [count, setCount] = useState(0);

  const boxes = () => Array.from(document.querySelectorAll<HTMLInputElement>('input[name="accidentIds"]'));
  const refresh = () => setCount(boxes().filter((b) => b.checked).length);

  // Os checkboxes vêm do servidor: acompanha a mudança de qualquer um deles.
  useEffect(() => {
    const onChange = (e: Event) => {
      if ((e.target as HTMLInputElement | null)?.name === "accidentIds") setCount(boxes().filter((b) => b.checked).length);
    };
    document.addEventListener("change", onChange);
    return () => document.removeEventListener("change", onChange);
  }, []);

  function selectAll(on: boolean) {
    boxes().forEach((b) => (b.checked = on));
    refresh();
  }

  function cancel() {
    const ids = boxes().filter((b) => b.checked).map((b) => b.value);
    if (ids.length === 0) return;
    if (!window.confirm(`Cancelar ${ids.length} acidente(s)? Eles somem da lista de ativos e dos indicadores. Nada é apagado: dá para reativar na aba Cancelados.`)) return;
    start(async () => {
      const res = await cancelAccidentsAction(ids);
      if (res.ok) {
        toast.success(`${res.cancelled} acidente(s) cancelado(s).`);
        setCount(0);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-muted px-4 py-2 text-xs">
      <button type="button" onClick={() => selectAll(true)} className="font-medium text-accent hover:underline">Selecionar todos</button>
      <button type="button" onClick={() => selectAll(false)} className="text-foreground-subtle hover:underline">Limpar seleção</button>
      <span className="text-foreground-subtle">{count} selecionado(s)</span>
      <Button size="sm" variant="outlineDanger" className="ml-auto" disabled={count === 0} loading={pending} onClick={cancel}>
        Cancelar selecionados
      </Button>
    </div>
  );
}
