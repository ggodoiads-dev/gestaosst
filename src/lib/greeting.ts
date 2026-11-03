import { formatInTimeZone } from "date-fns-tz";
import { APP_TIMEZONE } from "@/lib/dates";
import { greetingForHour, type Greeting } from "@/domain/home/greeting";

/** Saudação para agora, no horário de Brasília (serve no servidor e no navegador). */
export function greetingNow(): Greeting {
  return greetingForHour(Number(formatInTimeZone(new Date(), APP_TIMEZONE, "H")));
}
