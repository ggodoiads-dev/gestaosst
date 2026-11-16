import { NextResponse } from "next/server";
import { autoCreditHolidayWork } from "@/server/services/bank-hours.service";
import { db } from "@/server/db";

/** Rotina diária da Vercel (vercel.json): credita 1 dia de folga a quem trabalhou em feriado nacional (pela escala salva), sem ninguém precisar abrir a tela.
 * Idempotente. Exige `Authorization: Bearer CRON_SECRET`. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    // Autor do lançamento: um usuário ativo qualquer (a coluna guarda o id sem chave estrangeira); o nome mostrado é "Automático (escala)".
    const anyUser = await db.user.findFirst({ select: { id: true } });
    const result = await autoCreditHolidayWork({ id: anyUser?.id ?? "sistema", name: "Automático (escala)" });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron banco-de-horas] falha:", error);
    return NextResponse.json({ ok: false, error: "falha ao creditar os feriados" }, { status: 500 });
  }
}
