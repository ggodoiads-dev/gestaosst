"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { AlertCategory, AlertItem } from "@/server/services/alerts.service";

const CATEGORY_LABELS: Record<AlertCategory, string> = {
  QUALIFICACAO_VENCIDA: "Qualificação vencida",
  QUALIFICACAO_VENCENDO: "Qualificação vencendo",
  FALTA: "Falta",
  CHECKLIST_PENDENTE: "Checklist pendente",
};

const CATEGORY_TONES: Record<AlertCategory, "danger" | "warning" | "info"> = {
  QUALIFICACAO_VENCIDA: "danger",
  QUALIFICACAO_VENCENDO: "warning",
  FALTA: "danger",
  CHECKLIST_PENDENTE: "info",
};

export function AlertsBell({ items, count }: { items: AlertItem[]; count: number }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative flex items-center justify-center rounded-md p-2 text-foreground-subtle hover:bg-surface-muted hover:text-foreground focus:outline-none"
        aria-label={count > 0 ? `${count} alerta(s) pendente(s)` : "Alertas"}
      >
        <Bell className="size-4.5" />
        {count > 0 && (
          <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 max-h-[70vh] overflow-y-auto">
        <DropdownMenuLabel>Alertas{count > 0 ? ` (${count})` : ""}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-2.5 py-4 text-center text-sm text-foreground-subtle">Nada pendente por aqui.</p>
        ) : (
          items.map((item) => (
            <DropdownMenuItem key={item.id} asChild className="flex-col items-stretch gap-1 py-2">
              <Link href={item.href}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-foreground">{item.label}</span>
                  <Badge tone={CATEGORY_TONES[item.category]}>{CATEGORY_LABELS[item.category]}</Badge>
                </div>
                <span className="truncate text-xs text-foreground-subtle">{item.detail}</span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
