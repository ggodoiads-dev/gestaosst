"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { saveHeadcountBaseAction } from "@/server/actions/exit-interview.actions";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const keyOf = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;

/** QLP do turnover (o mesmo do BI). Normalmente é fixo: um valor para o ano todo. Quando muda no meio do ano, ajusta-se mês a mês. */
export function HeadcountBase({ year, base, lastMonthIdx }: { year: number; base: Record<string, number>; lastMonthIdx: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const years = [year - 1, year];
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(base).map(([k, v]) => [k, String(v)])));
  const [dirty, setDirty] = useState(false);

  // Valor fixo: o QLP que vale para o ano todo (se todos os meses informados são iguais), senão o do último mês informado.
  const informed = MONTHS.map((_, m) => base[keyOf(year, m)]).filter((v): v is number => typeof v === "number");
  const initialFixed = informed.length > 0 ? String(informed[informed.length - 1]) : "";
  const [fixed, setFixed] = useState(initialFixed);
  const differentMonths = new Set(informed).size > 1;

  function persist(entries: { month: string; headcount: number | null }[], message: string) {
    start(async () => {
      const res = await saveHeadcountBaseAction(entries);
      if (res.ok) {
        toast.success(message);
        setDirty(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function applyFixed() {
    const n = Number(fixed.trim().replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Informe o QLP (um número maior que zero).");
      return;
    }
    setValues((v) => ({ ...v, ...Object.fromEntries(MONTHS.map((_, m) => [keyOf(year, m), String(Math.round(n))])) }));
    persist(
      MONTHS.map((_, m) => ({ month: keyOf(year, m), headcount: n })),
      `QLP ${Math.round(n)} aplicado a todos os meses de ${year}.`,
    );
  }

  function saveGrid() {
    const entries = years.flatMap((y) =>
      MONTHS.map((_, m) => {
        const k = keyOf(y, m);
        const n = Number((values[k] ?? "").trim());
        return { month: k, headcount: (values[k] ?? "").trim() === "" || !Number.isFinite(n) ? null : n };
      }),
    );
    persist(entries, "QLP salvo.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>QLP (igual ao do BI)</CardTitle>
        <CardDescription>
          O turnover é demissões ÷ QLP. Se o seu QLP é fixo, informe o valor uma vez e aplique ao ano todo. Sem QLP informado, o SIGO estima pelo cadastro de colaboradores e o número não bate com o do BI.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-foreground-muted">
            QLP fixo de {year}
            <Input inputMode="decimal" value={fixed} onChange={(e) => setFixed(e.target.value.replace(/[^\d.,]/g, ""))} className="w-32" placeholder="57" />
          </label>
          <Button onClick={applyFixed} loading={pending}>
            Aplicar a todos os meses de {year}
          </Button>
          {differentMonths && <p className="text-xs text-warning">Hoje os meses de {year} têm QLP diferentes. Aplicar substitui todos por este valor.</p>}
        </div>

        <details className="rounded-md border border-border p-3">
          <summary className="cursor-pointer select-none text-sm font-medium text-foreground-muted">O QLP mudou no meio do ano? Ajustar mês a mês</summary>
          <div className="mt-3 flex flex-col gap-4">
            <p className="text-xs text-foreground-subtle">Mês em branco repete o último QLP informado antes dele.</p>
            {years.map((y) => (
              <div key={y} className="flex flex-col gap-1.5">
                <p className="text-xs font-semibold text-foreground-muted">{y}</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-12">
                  {MONTHS.map((label, m) => {
                    const k = keyOf(y, m);
                    const future = y === year && m > lastMonthIdx;
                    return (
                      <label key={k} className="flex flex-col gap-1 text-[11px] text-foreground-subtle">
                        {label}
                        <Input
                          inputMode="numeric"
                          value={values[k] ?? ""}
                          disabled={future}
                          onChange={(e) => {
                            setValues((v) => ({ ...v, [k]: e.target.value.replace(/\D/g, "") }));
                            setDirty(true);
                          }}
                          className="h-8 px-2"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
            <div>
              <Button variant="secondary" onClick={saveGrid} loading={pending} disabled={!dirty}>
                Salvar meses
              </Button>
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
