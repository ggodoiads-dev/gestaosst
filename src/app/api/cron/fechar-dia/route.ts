import { NextResponse } from "next/server";
import { freezeChecklistDays, yesterdayKey } from "@/server/services/checklist-compliance.service";

/** Rotina diária da Vercel (vercel.json): trava o resultado de checklist de ONTEM por colaborador. Assim, mudar o cadastro depois (equipamento de área,
 * checklist da função) não cria nem apaga ocorrência de dia passado. Exige `Authorization: Bearer CRON_SECRET`. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const frozen = await freezeChecklistDays(yesterdayKey());
    return NextResponse.json({ ok: true, frozen });
  } catch (error) {
    console.error("[cron fechar-dia] falha:", error);
    return NextResponse.json({ ok: false, error: "falha ao travar o dia" }, { status: 500 });
  }
}
