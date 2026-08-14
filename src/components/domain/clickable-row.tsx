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
    <TableRow clickable onClick={() => router.push(href)} {...props}>
      {children}
    </TableRow>
  );
}
