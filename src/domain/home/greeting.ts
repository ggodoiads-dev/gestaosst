/** Saudação pelo horário (hora cheia, 0 a 23, no fuso de Brasília): bom dia das 5h às 11h59, boa tarde das 12h às 17h59, boa noite no resto. */
export type Greeting = "Bom dia" | "Boa tarde" | "Boa noite";

export function greetingForHour(hour: number): Greeting {
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}
