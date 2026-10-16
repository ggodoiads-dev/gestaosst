"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { setActivityAreasAction } from "@/server/actions/activity.actions";

type AreaOption = { id: string; name: string; code: string; linked: boolean };

/** Escolhe em quais áreas os documentos desta atividade (POP, AR/VR, Lista de Treinamento) aparecem no QR Code público. */
export function ActivityAreasCard({ activityId, areas, available }: { activityId: string; areas: AreaOption[]; available: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(areas.filter((a) => a.linked).map((a) => a.id)));
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      const res = await setActivityAreasAction(activityId, [...selected]);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Áreas atualizadas. Os documentos já aparecem no QR Code delas.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aparece no QR Code das áreas</CardTitle>
        <CardDescription>
          Marque as áreas em que o POP, o AR/VR e a Lista de Treinamento desta atividade devem aparecer para visitantes que
          escaneiam o QR Code da área, junto com os colaboradores.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!available && (
          <p className="text-xs text-warning">Este recurso ainda está sendo ativado no sistema. Tente de novo em instantes.</p>
        )}
        {areas.length === 0 ? (
          <p className="text-sm text-foreground-subtle">Nenhuma área cadastrada.</p>
        ) : (
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {areas.map((a) => (
              <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-muted">
                <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} disabled={!available} className="size-4" />
                <span className="min-w-0 flex-1 truncate">{a.name}</span>
                <span className="shrink-0 font-mono text-[11px] text-foreground-subtle">{a.code}</span>
              </label>
            ))}
          </div>
        )}
        <div className="flex justify-end">
          <Button onClick={save} loading={pending} disabled={!available}>
            Salvar áreas
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
