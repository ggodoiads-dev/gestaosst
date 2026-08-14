import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";

/**
 * QR Code do equipamento sempre leva ao prontuário (visualização). De lá, se
 * o usuário tiver permissão, um botão "Realizar Checklist" fica disponível —
 * ele escolhe se só quer ver ou se quer iniciar a inspeção (seção 24). O
 * mesmo resolvedor também atende o QR individual de itens de EPI rastreáveis,
 * levando à ficha de EPI do colaborador dono do item.
 */
export default async function QrResolverPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await requireUser();
  const { token } = await params;

  const equipment = await db.equipment.findUnique({ where: { qrToken: token } });
  if (equipment) redirect(`/equipamentos/${equipment.id}`);

  const epiDelivery = await db.epiDelivery.findUnique({ where: { qrToken: token } });
  if (epiDelivery) redirect(`/colaboradores/${epiDelivery.collaboratorId}#epi-${epiDelivery.id}`);

  notFound();
}
