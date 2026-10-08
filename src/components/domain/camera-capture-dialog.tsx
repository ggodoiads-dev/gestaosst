"use client";

import { useEffect, useState } from "react";
import { Camera, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose } from "@/components/ui/dialog";

/** A câmera embutida só faz sentido se o navegador/WebView expõe a câmera pra página (HTTPS). */
export function canUseInAppCamera(): boolean {
  return typeof navigator !== "undefined" && typeof window !== "undefined" && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;
}

/**
 * Tira a foto DENTRO do SIGO, sem abrir o app de câmera do celular. No Android de entrada, abrir a câmera
 * do sistema faz o sistema encerrar o SIGO pra liberar memória — o colaborador voltava na tela inicial e a
 * foto se perdia. Aqui a câmera é só um <video> da própria página: o app nunca sai de cena.
 * Se a câmera embutida não abrir (permissão negada, aparelho sem suporte), oferece cair pra galeria/câmera
 * do sistema via `onFallback`.
 */
export function CameraCaptureDialog({
  open,
  onOpenChange,
  onCapture,
  onFallback,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
  onFallback: () => void;
}) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<"starting" | "ready" | "error">("starting");

  useEffect(() => {
    if (!open || !video) return;
    let stream: MediaStream | null = null;
    let cancelled = false;
    setStatus("starting");

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        video.srcObject = s;
        return video.play().then(() => {
          if (!cancelled) setStatus("ready");
        });
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };
  }, [open, video]);

  function takePhoto() {
    if (!video || !video.videoWidth) return;
    const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" }));
        onOpenChange(false);
      },
      "image/jpeg",
      0.82,
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tirar foto</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-black">
            <video ref={setVideo} playsInline muted autoPlay className="size-full object-cover" />
            {status === "starting" && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white/80">
                <Loader2 className="size-4 animate-spin" /> Abrindo a câmera...
              </div>
            )}
            {status === "error" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-white/90">
                <p>Não consegui abrir a câmera aqui (talvez a permissão esteja bloqueada).</p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    onOpenChange(false);
                    onFallback();
                  }}
                >
                  <ImageIcon className="size-4" /> Usar galeria / câmera do celular
                </Button>
              </div>
            )}
          </div>
          <button
            type="button"
            className="self-center text-xs text-accent hover:underline"
            onClick={() => {
              onOpenChange(false);
              onFallback();
            }}
          >
            Prefiro escolher da galeria
          </button>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button type="button" onClick={takePhoto} disabled={status !== "ready"}>
            <Camera className="size-4" /> Tirar foto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
