"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export function GlobalSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = value.trim();
    if (!query) return;
    router.push(`/busca?q=${encodeURIComponent(query)}`);
  }

  return (
    <form onSubmit={onSubmit} className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-foreground-subtle" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Buscar equipamento, código, patrimônio, NC..."
        className="pl-8"
        aria-label="Busca global"
      />
    </form>
  );
}
