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

/** Uma data corrompida no banco (ex: ano 20226 por erro de digitação) não pode derrubar a tela
 * inteira com `RangeError: Invalid time value` — mostra o valor como inválido e segue. */
function safeFormat(date: Date | string, format: () => string): string {
  try {
    return format();
  } catch {
    return "Data inválida";
  }
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return safeFormat(date, () => formatInTimeZone(new Date(date), APP_TIMEZONE, "dd/MM/yyyy HH:mm", { locale: ptBR }));
}

/** `startOfDay`/`new Date(ano, mes, dia)` no servidor (UTC) geram meia-noite UTC — um DIA de calendário,
 * não um instante. Formatado em Brasília (UTC-3) isso vira o dia ANTERIOR (o "hoje" aparecia como ontem).
 * Um instante real nunca cai em 00:00:00.000 UTC exato, então esse valor é tratado como data pura. */
function isUtcMidnight(date: Date): boolean {
  return (
    date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0
  );
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return safeFormat(date, () => {
    const value = new Date(date);
    return formatInTimeZone(value, isUtcMidnight(value) ? "UTC" : APP_TIMEZONE, "dd/MM/yyyy", { locale: ptBR });
  });
}

export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return safeFormat(date, () => formatInTimeZone(new Date(date), APP_TIMEZONE, "HH:mm", { locale: ptBR }));
}

export function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return safeFormat(date, () => formatDistanceToNow(new Date(date), { locale: ptBR, addSuffix: true }));
}

/** Instante em que o dia de HOJE começou no fuso do app (Brasília, UTC-3, sem horário de verão). O
 * `startOfDay` do servidor (UTC) começa às 21h do dia anterior em Brasília — checklist feito à noite de
 * ontem passava a contar como de hoje. */
export function startOfTodayInAppTimezone(now: Date = new Date()): Date {
  const dayKey = formatInTimeZone(now, APP_TIMEZONE, "yyyy-MM-dd");
  return new Date(`${dayKey}T00:00:00-03:00`);
}

export function formatLongDate(date: Date | string = new Date()): string {
  const text = formatInTimeZone(new Date(date), APP_TIMEZONE, "EEEE, dd 'de' MMMM", { locale: ptBR });
  return text.charAt(0).toUpperCase() + text.slice(1);
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
