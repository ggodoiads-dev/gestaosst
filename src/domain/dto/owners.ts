/**
 * Troca o "cargo responsável" que o Rico sugere (Liderança, Colaborador, RH, SST, Manutenção) por NOME de gente:
 *  - Colaborador -> o próprio avaliado;
 *  - Liderança   -> o líder do avaliado no DMPeople (coluna "Líder" da planilha); se não vier, quem lidera a área dele
 *                   (quem faz a chamada dela); por último, quem fez o DTO;
 *  - SST / RH    -> quem é dessa função (Técnico de Segurança / RH) e está ativo;
 *  - Manutenção  -> sem nome fixo (fica só o cargo).
 */
export type OwnerContext = {
  collaboratorName: string;
  leaderName: string | null;
  evaluatorName: string | null;
  areaLeaders: string[];
  sstPeople: string[];
  hrPeople: string[];
};

export function resolveOwnerNames(ownerRole: string, ctx: OwnerContext): string[] {
  const unique = (names: (string | null | undefined)[]) => [...new Set(names.filter((n): n is string => !!n && n.trim() !== ""))];
  switch (ownerRole) {
    case "Colaborador":
      return unique([ctx.collaboratorName]);
    case "Liderança":
      if (ctx.leaderName) return unique([ctx.leaderName]);
      if (ctx.areaLeaders.length > 0) return unique(ctx.areaLeaders);
      return unique([ctx.evaluatorName]);
    case "SST":
      return unique(ctx.sstPeople);
    case "RH":
      return unique(ctx.hrPeople);
    default:
      return [];
  }
}
