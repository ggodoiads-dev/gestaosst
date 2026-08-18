"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Check, X, Loader2, ChevronDown, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useRico } from "@/components/rico/rico-context";
import { RicoAvatar } from "@/components/rico/rico-avatar";
import { RicoMarkdown } from "@/components/rico/rico-markdown";
import { useSpeechRecognition } from "@/components/rico/use-speech-recognition";

export function RicoFloatingWidget() {
  const {
    messages,
    sending,
    sendMessage,
    confirmingIndex,
    confirmAction,
    cancelAction,
    proactiveTip,
    dismissTip,
  } = useRico();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const baseInputRef = useRef("");
  const { supported: micSupported, listening, start: startListening, stop: stopListening } = useSpeechRecognition(
    (text) => setInput(baseInputRef.current ? `${baseInputRef.current} ${text}` : text),
  );

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      const el = scrollAreaRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [open, messages.length, sending]);

  function handleOpen() {
    setOpen(true);
    dismissTip();
  }

  function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    if (listening) stopListening();
    setInput("");
    sendMessage(text);
  }

  function toggleMic() {
    if (listening) {
      stopListening();
    } else {
      baseInputRef.current = input.trim();
      startListening();
    }
  }

  const talking = !open && proactiveTip !== null;
  const avatarState = listening ? "listening" : sending ? "talking" : "idle";

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[28rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <div className="size-6">
                <RicoAvatar state={avatarState} />
              </div>
              <span className="text-sm font-semibold text-foreground">Rico</span>
            </div>
            <button
              aria-label="Fechar"
              className="text-foreground-subtle hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              <ChevronDown className="size-4" />
            </button>
          </div>

          <div ref={scrollAreaRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex flex-col gap-1", m.role === "user" ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-snug",
                    m.role === "user"
                      ? "whitespace-pre-wrap bg-accent text-accent-foreground"
                      : "bg-surface-muted text-foreground",
                  )}
                >
                  {m.role === "assistant" ? <RicoMarkdown content={m.content} /> : m.content}
                </div>

                {m.pendingAction && m.actionState === "pending" && (
                  <div className="flex max-w-[85%] flex-col gap-1.5 rounded-lg border border-accent/30 bg-accent-soft/40 px-3 py-2.5 text-[13px]">
                    <p className="font-medium">{m.pendingAction.label}</p>
                    <div className="flex gap-1.5">
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
          </div>

          <div className="flex items-end gap-1.5 border-t border-border p-2.5">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={listening ? "Ouvindo..." : "Fala com o Rico..."}
              rows={1}
              className="min-h-9 resize-none text-sm"
            />
            {micSupported && (
              <Button
                type="button"
                size="icon"
                variant={listening ? "danger" : "secondary"}
                onClick={toggleMic}
                aria-label={listening ? "Parar gravação de voz" : "Falar com o Rico por voz"}
                className={cn(listening && "animate-pulse")}
              >
                <Mic className="size-4" />
              </Button>
            )}
            <Button size="icon" onClick={handleSend} loading={sending} disabled={!input.trim()}>
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {!open && proactiveTip && (
        <div className="flex max-w-72 flex-col gap-2 rounded-xl border border-accent/30 bg-surface px-3.5 py-3 text-sm shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-semibold text-accent">Rico</span>
            <button
              aria-label="Dispensar"
              className="text-foreground-subtle hover:text-foreground"
              onClick={dismissTip}
            >
              <X className="size-3.5" />
            </button>
          </div>
          <button className="text-left text-foreground leading-snug" onClick={handleOpen}>
            {proactiveTip}
          </button>
        </div>
      )}

      <button
        aria-label="Abrir chat do Rico"
        onClick={handleOpen}
        className={cn(
          "flex size-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105",
          talking ? "animate-bounce" : !open && "animate-rico-bob",
        )}
      >
        <RicoAvatar state={talking ? "talking" : "idle"} />
      </button>
    </div>
  );
}
