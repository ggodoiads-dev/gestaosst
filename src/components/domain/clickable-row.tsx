"use client";

import { useRouter } from "next/navigation";
import { TableRow } from "@/components/ui/table";
import type { ComponentProps } from "react";

export function ClickableRow({
  href,
  children,
  ...props
}: { href: string } & Omit<ComponentProps<typeof TableRow>, "clickable" | "onClick">) {
  const router = useRouter();
  return (
    <TableRow
      clickable
      onClick={(e) => {
        // Clicou num link/botão dentro da linha (ex: "Imprimir"): deixa o link agir, sem navegar pra linha.
        if ((e.target as HTMLElement).closest("a, button")) return;
        router.push(href);
      }}
      {...props}
    >
      {children}
    </TableRow>
  );
}
