import { redirect } from "next/navigation";

/** A listagem de colaboradores (com ou sem dados de RH, conforme o perfil) virou uma tela só em
 * /colaboradores — mantém o link antigo funcionando em vez de quebrar quem tinha essa URL salva. */
export default function RhRedirect() {
  redirect("/colaboradores");
}
