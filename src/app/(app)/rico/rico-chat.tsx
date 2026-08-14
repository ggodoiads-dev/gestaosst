"use client";

import { useRef, useState } from "react";
import { Sparkles, Send, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useRico } from "@/components/rico/rico-context";

export function RicoChat() {
  const { messages, sending, sendMessage, confirmingIndex, confirmAction, cancelAction } = useRico();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  }

  function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    sendMessage(text);
    scrollToBottom();
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
                  <Button size="sm" onClick={() => confirmAction(i, m.pendingAction!)} loading={confirmingIndex === i}>
                    <Check className="size-3.5" /> Confirmar
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => cancelAction(i)} disabled={confirmingIndex === i}>
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
