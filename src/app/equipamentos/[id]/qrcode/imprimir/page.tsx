import { headers } from "next/headers";
import { requireUser } from "@/server/auth/current-user";
import { getEquipmentDetail } from "@/server/services/equipment.service";
import { generateEquipmentQrCode } from "@/server/services/qrcode.service";
import { PrintButton } from "@/components/domain/print-button";

export default async function EquipmentQrCodePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const equipment = await getEquipmentDetail(user, id);

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${protocol}://${host}`;
  const qrDataUrl = await generateEquipmentQrCode(equipment.qrToken, baseUrl);
  const qrUrl = `${baseUrl}/q/${equipment.qrToken}`;

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 bg-white p-8 text-center text-black print:p-0">
      <div className="no-print flex w-full justify-end">
        <PrintButton />
      </div>

      <p className="text-sm font-semibold uppercase tracking-wide">{equipment.code}</p>
      <p className="text-base font-bold">{equipment.name}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrDataUrl} alt={`QR Code do equipamento ${equipment.code}`} className="size-56" />
      <p className="break-all text-[10px] text-neutral-500">{qrUrl}</p>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>
    </div>
  );
}
