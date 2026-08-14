"use client";

import { useEffect, useRef } from "react";

type Result = { ok: boolean };

/**
 * Fecha um diálogo controlado quando uma submissão via `useActionState`
 * termina com sucesso. Só reage à transição pending=true -> pending=false;
 * ignora o estado inicial (que também tem `ok` indefinido/irrelevante),
 * evitando fechar o diálogo assim que ele é aberto.
 */
export function useCloseOnSuccess(pending: boolean, state: Result, onClose: () => void) {
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && state.ok) {
      onClose();
    }
    wasPending.current = pending;
  }, [pending, state, onClose]);
}
