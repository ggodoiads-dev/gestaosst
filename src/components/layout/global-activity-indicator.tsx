"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * Avisa que o sistema está carregando/pensando — SEMPRE, em qualquer tela. Toda navegação entre telas,
 * toda Server Action (salvar, enviar, importar...) e toda chamada de API passam por `fetch`, então
 * contar as requisições em andamento cobre tudo de uma vez, sem depender de cada botão lembrar de
 * mostrar um spinner. Só aparece se demorar mais que ~150ms (pra não piscar em respostas rápidas) e
 * ignora o prefetch de links, que o Next faz em segundo plano.
 */
export function GlobalActivityIndicator() {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let pending = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let visible = false;

    const refresh = () => {
      if (pending > 0 && !visible && !timer) {
        timer = setTimeout(() => {
          timer = null;
          visible = true;
          setBusy(true);
        }, 150);
      } else if (pending === 0) {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        if (visible) {
          visible = false;
          setBusy(false);
        }
      }
    };

    const isPrefetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      return headers.has("next-router-prefetch") || headers.get("purpose") === "prefetch";
    };

    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const track = !isPrefetch(input, init);
      if (track) {
        pending++;
        refresh();
      }
      try {
        return await originalFetch.call(window, input, init);
      } finally {
        if (track) {
          pending--;
          refresh();
        }
      }
    };

    return () => {
      window.fetch = originalFetch;
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!busy) return null;

  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 top-0 z-[200]">
      <div className="h-[3px] w-full overflow-hidden bg-accent/15">
        <div className="sigo-progress h-full w-1/3 rounded-full bg-accent" />
      </div>
      <div className="mx-auto mt-2 flex w-fit items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-foreground-muted shadow-md">
        <Loader2 className="size-3.5 animate-spin text-accent" />
        Carregando...
      </div>
    </div>
  );
}
