import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { generateAreaQrCode } from "@/server/services/qrcode.service";
import { PrintButton } from "@/components/domain/print-button";

export default async function AreaQrCodePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();
  const area = await db.area.findUnique({ where: { id }, include: { unit: true } });
  if (!area || !area.qrToken) notFound();

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${protocol}://${host}`;
  const qrDataUrl = await generateAreaQrCode(area.qrToken, baseUrl);
  const qrUrl = `${baseUrl}/q/${area.qrToken}`;

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 bg-white p-8 text-center text-black print:p-0">
      <div className="no-print flex w-full justify-end">
        <PrintButton />
      </div>

      <p className="text-sm font-semibold uppercase tracking-wide">{area.code}</p>
      <p className="text-base font-bold">{area.name}</p>
      <p className="text-xs text-neutral-500">{area.unit.name}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrDataUrl} alt={`QR Code da área ${area.code}`} className="size-56" />
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
