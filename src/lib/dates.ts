import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";

/**
 * Fuso horário de referência da aplicação (seção 60 do documento: operação no Brasil).
 * Toda formatação de data/hora exibida ao usuário passa por ele explicitamente — o
 * runtime do servidor roda em UTC em produção (Vercel), então formatar sem fixar o
 * fuso mostraria a hora errada (ex: 16:00 UTC em vez de 13:00 em São Paulo).
 */
export const APP_TIMEZONE = "America/Sao_Paulo";

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return formatInTimeZone(new Date(date), APP_TIMEZONE, "dd/MM/yyyy HH:mm", { locale: ptBR });
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return formatInTimeZone(new Date(date), APP_TIMEZONE, "dd/MM/yyyy", { locale: ptBR });
}

export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return formatInTimeZone(new Date(date), APP_TIMEZONE, "HH:mm", { locale: ptBR });
}

export function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return formatDistanceToNow(new Date(date), { locale: ptBR, addSuffix: true });
}

/**
 * Converte um valor de `<input type="date">` (ex: "2026-08-12") em um Date
 * que representa meio-dia local, evitando que a data avance ou recue um dia
 * ao ser formatada depois — `new Date("2026-08-12")` é interpretado como
 * meia-noite UTC, o que pode virar o dia anterior em fusos horários atrás
 * de UTC (seção 60 do documento: nunca depender de conversões implícitas).
 */
export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0);
}

export function formatMinutes(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "0 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}h ${rest}min` : `${hours}h`;
}
