"use client";

import { createContext, useCallback, useContext, useRef, useState, useTransition } from "react";
import {
  sendRicoMessageAction,
  confirmRicoActionAction,
  getRicoProactiveTipAction,
  type PendingAction,
  type ProactiveSignal,
} from "@/server/actions/rico.actions";

export type RicoMessage = {
  role: "user" | "assistant";
  content: string;
  pendingAction?: PendingAction | null;
  actionState?: "pending" | "confirmed" | "cancelled";
};

type RicoContextValue = {
  messages: RicoMessage[];
  sending: boolean;
  sendMessage: (text: string) => void;
  confirmingIndex: number | null;
  confirmAction: (index: number, action: PendingAction) => void;
  cancelAction: (index: number) => void;
  proactiveTip: string | null;
  notifyContext: (signal: ProactiveSignal) => void;
  dismissTip: () => void;
};

const RicoContext = createContext<RicoContextValue | null>(null);

function signalKey(signal: ProactiveSignal): string {
  return `${signal.kind}:${signal.equipmentCode}:${signal.questionTitle}:${signal.answerValue}`;
}

export function RicoProvider({
  userFirstName,
  children,
}: {
  userFirstName: string;
  children: React.ReactNode;
}) {
  const [messages, setMessages] = useState<RicoMessage[]>([
    {
      role: "assistant",
      content: `E aí, ${userFirstName}! Eu sou o Rico. Pode perguntar sobre checklists, não conformidades, risco dos equipamentos, qualificações, acidentes — ou pedir pra eu criar uma atividade ou registrar uma qualificação. Manda ver.`,
    },
  ]);
  const [sending, startSending] = useTransition();
  const [confirmingIndex, setConfirmingIndex] = useState<number | null>(null);
  const [proactiveTip, setProactiveTip] = useState<string | null>(null);
  const seenSignals = useRef<Set<string>>(new Set());

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      setMessages((prev) => [...prev, { role: "user", content: trimmed }]);

      startSending(async () => {
        const result = await sendRicoMessageAction(history, trimmed);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: result.reply,
            pendingAction: result.pendingAction,
            actionState: result.pendingAction ? "pending" : undefined,
          },
        ]);
      });
    },
    [messages],
  );

  const confirmAction = useCallback((index: number, action: PendingAction) => {
    setConfirmingIndex(index);
    confirmRicoActionAction(action).then((result) => {
      setConfirmingIndex(null);
      setMessages((prev) => {
        const next = [...prev];
        if (next[index]) next[index] = { ...next[index], actionState: result.ok ? "confirmed" : "pending" };
        return [
          ...next,
          {
            role: "assistant",
            content: result.ok ? `✅ ${result.message}` : `Não deu certo: ${result.error}`,
          },
        ];
      });
    });
  }, []);

  const cancelAction = useCallback((index: number) => {
    setMessages((prev) => {
      const next = [...prev];
      if (next[index]) next[index] = { ...next[index], actionState: "cancelled" };
      return next;
    });
  }, []);

  const notifyContext = useCallback((signal: ProactiveSignal) => {
    const key = signalKey(signal);
    if (seenSignals.current.has(key)) return;
    seenSignals.current.add(key);

    getRicoProactiveTipAction(signal).then((tip) => {
      if (tip) setProactiveTip(tip);
    });
  }, []);

  const dismissTip = useCallback(() => setProactiveTip(null), []);

  return (
    <RicoContext.Provider
      value={{
        messages,
        sending,
        sendMessage,
        confirmingIndex,
        confirmAction,
        cancelAction,
        proactiveTip,
        notifyContext,
        dismissTip,
      }}
    >
      {children}
    </RicoContext.Provider>
  );
}

export function useRico(): RicoContextValue {
  const ctx = useContext(RicoContext);
  if (!ctx) throw new Error("useRico deve ser usado dentro de um RicoProvider");
  return ctx;
}
