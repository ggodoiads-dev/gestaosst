import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";
import { getUiTheme } from "@/lib/ui-theme";
import { HomeNovo } from "../inicio/home-novo";
import { HomeTabs } from "../inicio/home-tabs";
import { loadHomeNovoProps } from "../inicio/load-home-data";

/** Painel do visual novo: os números e as pendências do dia. No visual clássico a tela inicial de sempre já traz tudo, então volta para ela. */
export default async function PainelPage() {
  const user = await requireUser();
  if ((await getUiTheme()) !== "novo") redirect("/inicio");
  const data = await loadHomeNovoProps(user);
  return (
    <div>
      <div className="flex justify-center px-4 pt-5">
        <HomeTabs active="painel" />
      </div>
      <HomeNovo {...data} />
    </div>
  );
}
