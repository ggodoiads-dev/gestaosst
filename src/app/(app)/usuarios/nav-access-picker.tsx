"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { SelectableNavGroup } from "@/server/services/nav-access.service";

/**
 * Escolha das abas que o Auditor pode ver. Fica dentro do <form> (os hidden inputs vão junto no envio): `navRestrict=1` avisa o servidor que a
 * escolha foi mostrada, e cada aba marcada vai em `navHrefs`. Marcando todas, o usuário fica sem restrição.
 */
export function NavAccessPicker({ groups, initial }: { groups: SelectableNavGroup[]; initial: string[] }) {
  const all = groups.flatMap((g) => g.items.map((i) => i.href));
  const [selected, setSelected] = useState<Set<string>>(new Set(initial.filter((h) => all.includes(h))));

  function toggle(href: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  }

  function toggleGroup(group: SelectableNavGroup, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const i of group.items) {
        if (on) next.add(i.href);
        else next.delete(i.href);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <input type="hidden" name="navRestrict" value="1" />
      {[...selected].map((href) => (
        <input key={href} type="hidden" name="navHrefs" value={href} />
      ))}
      <div className="flex items-center justify-between gap-2">
        <Label>O que este auditor pode ver</Label>
        <span className="text-xs text-foreground-subtle">
          {selected.size} de {all.length} abas
        </span>
      </div>
      <p className="text-xs text-foreground-subtle">
        Marque só as abas que ele precisa. O que ficar desmarcado some do menu e não abre nem pelo endereço. A tela inicial e os termos de uso são sempre liberados. Marcando todas, ele fica sem restrição.
      </p>
      <div className="flex gap-3">
        <button type="button" onClick={() => setSelected(new Set(all))} className="text-xs text-accent hover:underline">
          Marcar todas
        </button>
        <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-foreground-subtle hover:underline">
          Desmarcar todas
        </button>
      </div>
      <div className="flex max-h-72 flex-col gap-3 overflow-y-auto rounded-md border border-border p-2.5">
        {groups.map((g) => {
          const marked = g.items.filter((i) => selected.has(i.href)).length;
          return (
            <div key={g.key} className="flex flex-col gap-1">
              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
                <Checkbox checked={marked === g.items.length} onCheckedChange={(v) => toggleGroup(g, v === true)} />
                {g.title}
                <span className="font-normal normal-case tracking-normal">({marked}/{g.items.length})</span>
              </label>
              {g.items.map((i) => (
                <label key={i.href} className="ml-6 flex items-center gap-2 text-sm text-foreground-muted">
                  <Checkbox checked={selected.has(i.href)} onCheckedChange={() => toggle(i.href)} />
                  {i.label}
                </label>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
