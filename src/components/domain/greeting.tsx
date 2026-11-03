"use client";

import { useEffect, useState } from "react";
import { greetingNow } from "@/lib/greeting";
import type { Greeting as GreetingText } from "@/domain/home/greeting";

/** Bom dia, boa tarde ou boa noite pelo horário de Brasília, acompanhando o relógio com a tela aberta. `initial` vem do servidor (evita piscar ao carregar). */
export function Greeting({ initial, lowercase = false }: { initial: GreetingText; lowercase?: boolean }) {
  const [text, setText] = useState<GreetingText>(initial);
  useEffect(() => {
    const tick = () => setText(greetingNow());
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);
  return <>{lowercase ? text.toLowerCase() : text}</>;
}
