"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/ui/label";

const CATEGORY_LABELS: Record<string, string> = {
  NR: "NR",
  ASO: "ASO",
  INTEGRACAO: "Integração",
  OUTRO: "Outro",
};

const STATUS_LABELS: Record<string, string> = {
  valido: "Válido",
  vencendo: "Vencendo em 30 dias",
  vencido: "Vencido",
};

export function QualificationFiltersBar({
  categories,
  types,
  current,
}: {
  categories: string[];
  types: { id: string; name: string; category: string }[];
  current: { category?: string; qualificationTypeId?: string; status?: string };
}) {
  const router = useRouter();

  function update(next: Partial<{ category: string; qualificationTypeId: string; status: string }>) {
    const params = new URLSearchParams();
    const merged = { ...current, ...next };
    if (merged.category && merged.category !== "all") params.set("categoria", merged.category);
    if (merged.qualificationTypeId && merged.qualificationTypeId !== "all") {
      params.set("tipo", merged.qualificationTypeId);
    }
    if (merged.status && merged.status !== "all") params.set("status", merged.status);
    const query = params.toString();
    router.push(query ? `/qualificacoes?${query}` : "/qualificacoes");
  }

  const filteredTypes = current.category ? types.filter((t) => t.category === current.category) : types;

  return (
    <div className="flex flex-wrap gap-3">
      <div className="w-44">
        <FormField label="Categoria">
          <Select
            value={current.category ?? "all"}
            onValueChange={(v) => update({ category: v, qualificationTypeId: "all" })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>
      <div className="w-56">
        <FormField label="Tipo">
          <Select
            value={current.qualificationTypeId ?? "all"}
            onValueChange={(v) => update({ qualificationTypeId: v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {filteredTypes.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>
      <div className="w-52">
        <FormField label="Status">
          <Select value={current.status ?? "all"} onValueChange={(v) => update({ status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>
    </div>
  );
}
