"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { saveHeadcountBaseAction } from "@/server/actions/exit-interview.actions";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Efetivo oficial de cada mês. Mês em branco usa a estimativa do cadastro (admissão e inativação). */
export function HeadcountBase({ year, base, lastMonthIdx }: { year: number; base: Record<string, number>; lastMonthIdx: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const years = [year - 1, year];
  const keyOf = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(base).map(([k, v]) => [k, String(v)])));
  const [dirty, setDirty] = useState(false);

  function save() {
    const entries = years.flatMap((y) =>
      MONTHS.map((_, m) => {
        const k = keyOf(y, m);
        const n = Number((values[k] ?? "").trim());
        return { month: k, headcount: (values[k] ?? "").trim() === "" || !Number.isFinite(n) ? null : n };
      }),
    );
    start(async () => {
      const res = await saveHeadcountBaseAction(entries);
      if (res.ok) {
        toast.success("Efetivo salvo.");
        setDirty(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Base de efetivo (opcional)</CardTitle>
        <CardDescription>
          O turnover divide as saídas pelo efetivo médio. Por padrão o SIGO estima o efetivo pelo cadastro. Se você tem o efetivo oficial de cada mês (a base do RH), informe aqui: o mês preenchido passa a valer no lugar da estimativa. Deixe em branco para usar o cadastro.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
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
          <Button onClick={save} loading={pending} disabled={!dirty}>
            Salvar efetivo
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
