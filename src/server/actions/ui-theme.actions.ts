"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { UI_COOKIE, type UiTheme } from "@/lib/ui-theme";

/** Liga ou desliga o visual novo só para quem clicou (cookie do navegador, 1 ano). */
export async function setUiThemeAction(theme: UiTheme): Promise<void> {
  const jar = await cookies();
  if (theme === "novo") jar.set(UI_COOKIE, "novo", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: false });
  else jar.delete(UI_COOKIE);
  revalidatePath("/", "layout");
}
