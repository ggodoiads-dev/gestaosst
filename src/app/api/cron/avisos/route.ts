import { NextResponse } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { APP_TIMEZONE } from "@/lib/dates";
import { renderDigest } from "@/domain/alerts/rules";
import { listAlerts, sendEmail } from "@/server/services/daily-digest.service";

/** Resumo diário de avisos por e-mail. Chamada pela rotina agendada da Vercel (vercel.json), que envia `Authorization: Bearer CRON_SECRET`.
 * Só envia quando há pelo menos um aviso. Destinatários: variável `ALERTS_TO` (e-mails separados por vírgula). */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const alerts = await listAlerts();
  if (alerts.length === 0) return NextResponse.json({ ok: true, alerts: 0, sent: false, reason: "sem avisos" });

  const baseUrl = (process.env.APP_BASE_URL ?? "https://sigo.log.br").replace(/\/$/, "");
  const digest = renderDigest(alerts, baseUrl, formatInTimeZone(new Date(), APP_TIMEZONE, "dd/MM/yyyy"));
  const to = (process.env.ALERTS_TO ?? "").split(",").map((e) => e.trim()).filter(Boolean);
  const result = await sendEmail({ to, ...digest });
  return NextResponse.json({ ok: true, alerts: alerts.length, ...result });
}
