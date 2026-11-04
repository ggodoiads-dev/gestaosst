"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { linkNamesAction } from "@/server/actions/pipeline-matrix.actions";

/** Liga ao cadastro as pessoas da matriz e dos especialistas que vieram da planilha só com o nome curto. */
export function LinkNamesButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run() {
    start(async () => {
      const res = await linkNamesAction();
      if (!res.ok) return void toast.error(res.error);
      if (res.unmatched.length > 0) toast.warning(`${res.linked} vinculado(s). Sem correspondência única no cadastro: ${res.unmatched.slice(0, 6).join(", ")}${res.unmatched.length > 6 ? "…" : ""}.`, { duration: 9000 });
      else toast.success(res.linked > 0 ? `${res.linked} pessoa(s) ligada(s) ao cadastro.` : "Todos já estavam ligados ao cadastro.");
      router.refresh();
    });
  }

  return (
    <Button variant="secondary" onClick={run} loading={pending} title="Liga ao cadastro de colaboradores as pessoas da matriz e dos especialistas que vieram só com o nome curto">
      <Link2 className="size-4" /> Correlacionar nomes com o cadastro
    </Button>
  );
}
