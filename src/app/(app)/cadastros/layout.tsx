import { redirect } from "next/navigation";
import { hasPermission, requireUser } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";

/** Cadastros (tipos, modelos, funções, áreas...) são só do Administrador — o Gestor vê tudo, menos esta parte. */
export default async function CadastrosLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!hasPermission(user, PERMISSIONS.USER_MANAGE)) redirect("/inicio");
  return children;
}
