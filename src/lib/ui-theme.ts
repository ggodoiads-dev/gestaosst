import "server-only";
import { cookies } from "next/headers";

/** Visual do SIGO: "classico" (o de sempre) ou "novo" (repaginação). Fica em cookie por pessoa; o clássico é o padrão e nada muda para quem não ligar o novo. */
export type UiTheme = "classico" | "novo";
export const UI_COOKIE = "sigo_ui";

export async function getUiTheme(): Promise<UiTheme> {
  return (await cookies()).get(UI_COOKIE)?.value === "novo" ? "novo" : "classico";
}
