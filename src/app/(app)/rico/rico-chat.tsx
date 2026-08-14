"use client";

import { useRef, useState, useTransition } from "react";
import { Sparkles, Send, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  sendRicoMessageAction,
  confirmRicoActionAction,
  type PendingAction,
} from "@/server/actions/rico.actions";

type Message = {
  role: "user" | "assistant";
  content: string;
  pendingAction?: PendingAction | null;
  actionState?: "pending" | "confirmed" | "cancelled";
};

export function RicoChat({ userFirstName }: { userFirstName: string }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `E aí, ${userFirstName}! Eu sou o Rico. Pode perguntar sobre checklists, não conformidades, risco dos equipamentos, qualificações, acidentes — ou pedir pra eu criar uma atividade ou registrar uma qualificação. Manda ver.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, startSending] = useTransition();
  const [confirmingIndex, setConfirmingIndex] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  }

  function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    scrollToBottom();

    startSending(async () => {
      const result = await sendRicoMessageAction(history, text);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.reply,
          pendingAction: result.pendingAction,
          actionState: result.pendingAction ? "pending" : undefined,
        },
      ]);
      scrollToBottom();
    });
  }

  function handleConfirm(index: number, action: PendingAction) {
    setConfirmingIndex(index);
    confirmRicoActionAction(action).then((result) => {
      setConfirmingIndex(null);
      setMessages((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], actionState: result.ok ? "confirmed" : "pending" };
        return [
          ...next,
          {
            role: "assistant",
            content: result.ok ? `✅ ${result.message}` : `Não deu certo: ${result.error}`,
          },
        ];
      });
      if (!result.ok) toast.error(result.error);
      scrollToBottom();
    });
  }

  function handleCancel(index: number) {
    setMessages((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], actionState: "cancelled" };
      return next;
    });
  }

  return (
    <div className="flex h-[calc(100vh-220px)] flex-col rounded-lg border border-border bg-surface">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex flex-col gap-1.5", m.role === "user" ? "items-end" : "items-start")}>
            <div className="flex items-center gap-1.5 text-xs text-foreground-subtle">
              {m.role === "assistant" && <Sparkles className="size-3 text-accent" />}
              <span>{m.role === "assistant" ? "Rico" : "Você"}</span>
            </div>
            <div
              className={cn(
                "max-w-[80%] rounded-lg px-3.5 py-2.5 text-sm whitespace-pre-wrap",
                m.role === "user" ? "bg-accent text-accent-foreground" : "bg-surface-muted text-foreground",
              )}
            >
              {m.content}
            </div>

            {m.pendingAction && m.actionState === "pending" && (
              <div className="flex max-w-[80%] flex-col gap-2 rounded-lg border border-accent/30 bg-accent-soft/40 px-3.5 py-3 text-sm">
                <p className="font-medium">{m.pendingAction.label}</p>
                <p className="text-xs text-foreground-subtle">Rico só executa depois que você confirmar.</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleConfirm(i, m.pendingAction!)} loading={confirmingIndex === i}>
                    <Check className="size-3.5" /> Confirmar
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => handleCancel(i)} disabled={confirmingIndex === i}>
                    <X className="size-3.5" /> Cancelar
                  </Button>
                </div>
              </div>
            )}
            {m.pendingAction && m.actionState === "cancelled" && (
              <p className="text-xs text-foreground-subtle">Ação cancelada.</p>
            )}
          </div>
        ))}
        {sending && (
          <div className="flex items-center gap-1.5 text-xs text-foreground-subtle">
            <Loader2 className="size-3 animate-spin" /> Rico está pensando...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-end gap-2 border-t border-border p-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Pergunte alguma coisa ou peça uma ação..."
          rows={1}
          className="min-h-9 resize-none"
        />
        <Button size="icon" onClick={handleSend} loading={sending} disabled={!input.trim()}>
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
