"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search, CornerDownLeft } from "lucide-react";
import { NAV_ICONS, type NavGroup } from "@/components/layout/nav-items";

export function CommandPalette({ groups }: { groups: NavGroup[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setQuery("");
  }

  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        handleOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0);
  }, [groups, query]);

  const flatItems = useMemo(() => filteredGroups.flatMap((g) => g.items), [filteredGroups]);

  function go(href: string) {
    handleOpenChange(false);
    router.push(href);
  }

  function onInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && flatItems[0]) go(flatItems[0].href);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          className="group flex w-full items-center gap-2.5 rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-left text-sm text-white/60 backdrop-blur-sm transition-colors hover:border-white/25 hover:bg-white/10"
        >
          <Search className="size-4 shrink-0" />
          <span className="flex-1">Buscar um módulo do sistema...</span>
          <kbd className="hidden shrink-0 items-center gap-0.5 rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/70 sm:flex">
            Ctrl K
          </kbd>
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[18%] z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <DialogPrimitive.Title className="sr-only">Buscar módulo do sistema</DialogPrimitive.Title>
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <Search className="size-4 shrink-0 text-foreground-subtle" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Digite pra buscar um módulo..."
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-foreground-subtle"
            />
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {flatItems.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-foreground-subtle">Nenhum módulo encontrado.</p>
            )}
            {filteredGroups.map((group) => (
              <div key={group.key} className="mb-1 last:mb-0">
                {group.title && (
                  <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle">
                    {group.title}
                  </p>
                )}
                {group.items.map((item) => {
                  const Icon = NAV_ICONS[item.icon];
                  return (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => go(item.href)}
                      className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-surface-muted"
                    >
                      <Icon className="size-4 shrink-0 text-foreground-subtle" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 border-t border-border px-4 py-2 text-[11px] text-foreground-subtle">
            <CornerDownLeft className="size-3" /> pra abrir o primeiro resultado
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
