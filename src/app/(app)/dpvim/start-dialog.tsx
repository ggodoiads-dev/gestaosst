"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/label";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CameraCaptureDialog, canUseInAppCamera } from "@/components/domain/camera-capture-dialog";
import { compressImage } from "@/lib/compress-image";
import { startDpvimSessionAction } from "@/server/actions/dpvim.actions";

const field = "h-9 w-full rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground";

/** Abrir a DPVIM: foto de confirmação (obrigatória) e a dupla (opcional). Fica registrado quem abriu e quando. */
export function StartDpvimDialog({
  dpvimId,
  code,
  collaborators,
  myCollaboratorId,
  size = "sm",
}: {
  dpvimId: string;
  code: string;
  collaborators: { id: string; name: string }[];
  myCollaboratorId: string | null;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pending, start] = useTransition();
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [partnerId, setPartnerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPhoto(file: File) {
    const compressed = await compressImage(file);
    setPhoto(compressed);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(compressed);
    });
  }

  function submit() {
    if (!photo) return;
    setError(null);
    start(async () => {
      const formData = new FormData();
      formData.append("file", photo);
      const res = await startDpvimSessionAction(dpvimId, partnerId || null, formData);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`${code} aberta. Bom trabalho!`);
      setOpen(false);
      setPhoto(null);
      setPreview(null);
      setPartnerId("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={size}>
          <Play className="size-4" /> Abrir e começar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Abrir {code}</DialogTitle>
          <DialogDescription>Tire a foto da carga para confirmar que você está com ela e começar. Fica registrado quem abriu e a hora.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPhoto(f);
            }}
          />
          <button
            type="button"
            onClick={() => (canUseInAppCamera() ? setCameraOpen(true) : fileRef.current?.click())}
            className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border-strong bg-surface-muted px-4 py-6 text-sm text-foreground-muted transition-colors hover:bg-neutral-soft"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- pré-visualização local (blob:), next/image não se aplica
              <img src={preview} alt="Foto de confirmação" className="max-h-48 rounded-md object-cover" />
            ) : (
              <>
                <Camera className="size-4" /> Tirar a foto de confirmação
              </>
            )}
          </button>
          {preview && (
            <button type="button" className="self-start text-xs text-accent hover:underline" onClick={() => (canUseInAppCamera() ? setCameraOpen(true) : fileRef.current?.click())}>
              Tirar outra foto
            </button>
          )}
          <CameraCaptureDialog open={cameraOpen} onOpenChange={setCameraOpen} onCapture={(f) => void onPhoto(f)} onFallback={() => fileRef.current?.click()} />
          <FormField label="Sua dupla" hint="Opcional — a atividade é feita em dupla">
            <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className={field}>
              <option value="">Sem dupla definida</option>
              {collaborators
                .filter((c) => c.id !== myCollaboratorId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </FormField>
          {error && <p className="text-sm text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancelar
            </Button>
          </DialogClose>
          <Button onClick={submit} loading={pending} disabled={!photo}>
            Começar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
