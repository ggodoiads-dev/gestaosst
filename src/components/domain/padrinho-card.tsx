import { Award, ExternalLink, Infinity as InfinityIcon, Sparkles } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { attachmentUrl } from "@/lib/attachment-url";

/** Cartão de destaque "Padrinho certificado" pro perfil do colaborador. Só renderiza quando existe a qualificação. */
export function PadrinhoCard({
  completedDate,
  certificate,
  isSelf = false,
}: {
  completedDate: Date;
  certificate: { path: string; mimeType: string } | null;
  isSelf?: boolean;
}) {
  const isImage = certificate?.mimeType.startsWith("image/");
  return (
    <div className="relative overflow-hidden rounded-xl border border-warning/40 bg-gradient-to-br from-brand via-brand to-accent/80 p-4 text-white shadow-sm sm:p-5">
      <Sparkles className="pointer-events-none absolute -right-2 -top-2 size-24 text-white/10" aria-hidden />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center rounded-full bg-warning text-white shadow-md ring-4 ring-white/15">
            <Award className="size-8" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-accent">Certificação</p>
            <h3 className="text-xl font-bold leading-tight">Padrinho certificado</h3>
            <p className="text-sm text-white/75">Trilha de Treinamento para Padrinhos</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-white/15 px-2.5 py-1 font-medium">Concluído em {formatDate(completedDate)}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 font-medium">
                <InfinityIcon className="size-3.5" /> Sem validade
              </span>
            </div>
            <p className="mt-2 text-xs text-white/60">
              {isSelf ? "Você está habilitado(a) a apadrinhar novos colaboradores." : "Habilitado(a) a apadrinhar novos colaboradores."}
            </p>
          </div>
        </div>

        {certificate && (
          <a
            href={attachmentUrl(certificate.path)}
            target="_blank"
            rel="noreferrer"
            className="group flex shrink-0 items-center gap-3 self-start rounded-lg bg-white/10 p-2 pr-3 text-sm font-medium hover:bg-white/20 sm:self-center"
          >
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={attachmentUrl(certificate.path)} alt="Certificado de padrinho" className="h-14 w-24 rounded-md bg-white object-cover" />
            ) : (
              <span className="grid h-14 w-24 place-items-center rounded-md bg-white/15 text-xs">Certificado</span>
            )}
            <span className="flex items-center gap-1">
              Ver certificado <ExternalLink className="size-3.5 opacity-70 group-hover:opacity-100" />
            </span>
          </a>
        )}
      </div>
    </div>
  );
}
