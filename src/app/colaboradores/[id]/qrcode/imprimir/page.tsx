import { headers } from "next/headers";
import { requireUser } from "@/server/auth/current-user";
import { getCollaboratorDetail } from "@/server/services/collaborator.service";
import { generateCollaboratorQrCode } from "@/server/services/qrcode.service";
import { PrintButton } from "@/components/domain/print-button";

export default async function CollaboratorQrCodePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const collaborator = await getCollaboratorDetail(user, id);

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${protocol}://${host}`;
  const qrDataUrl = collaborator.qrToken ? await generateCollaboratorQrCode(collaborator.qrToken, baseUrl) : null;
  const qrUrl = collaborator.qrToken ? `${baseUrl}/q/${collaborator.qrToken}` : null;

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 bg-white p-8 text-center text-black print:p-0">
      <div className="no-print flex w-full justify-end">
        <PrintButton />
      </div>

      <p className="text-base font-bold">{collaborator.name}</p>
      {collaborator.cargo && <p className="text-sm">{collaborator.cargo}</p>}
      {qrDataUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt={`QR Code de ${collaborator.name}`} className="size-56" />
          <p className="break-all text-[10px] text-neutral-500">{qrUrl}</p>
        </>
      ) : (
        <p className="text-sm text-neutral-500">Este colaborador ainda não tem QR Code gerado.</p>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>
    </div>
  );
}
