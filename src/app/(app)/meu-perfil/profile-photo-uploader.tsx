"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateMyPhotoAction } from "@/server/actions/profile.actions";
import { compressImage } from "@/lib/compress-image";
import { withTimeout, connectionErrorMessage } from "@/lib/with-timeout";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Foto de perfil clicável: o colaborador escolhe da galeria ou tira na hora. */
export function ProfilePhotoUploader({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function handleSelected(file: File) {
    setSaving(true);
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    try {
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append("file", compressed);
      const result = await withTimeout(updateMyPhotoAction(formData));
      if (!result.ok) {
        setPreview(null);
        toast.error(result.error);
        return;
      }
      toast.success("Foto atualizada.");
      router.refresh();
    } catch (error) {
      setPreview(null);
      toast.error(connectionErrorMessage(error, "Não foi possível enviar a foto. Verifique sua conexão."));
    } finally {
      setSaving(false);
    }
  }

  const shown = preview ?? photoUrl;

  return (
    <div className="relative size-24 shrink-0 sm:size-28">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleSelected(file);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={saving}
        aria-label="Trocar minha foto"
        className="group size-full overflow-hidden rounded-full border-4 border-white/90 bg-accent-soft shadow-lg ring-1 ring-black/5 transition-transform hover:scale-[1.03]"
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- servida pela rota autenticada /api/uploads ou blob: local
          <img src={shown} alt={`Foto de ${name}`} className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-3xl font-semibold text-accent">{initials(name)}</span>
        )}
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          <Camera className="size-6 text-white" />
        </span>
      </button>
      <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex size-8 items-center justify-center rounded-full border-2 border-white bg-accent text-accent-foreground shadow">
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
      </span>
    </div>
  );
}
