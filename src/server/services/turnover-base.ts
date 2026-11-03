import "server-only";
import { db } from "@/server/db";
import { buildPresence, type Presence } from "@/domain/termination/presence";

/** Quem estava na casa (cadastro + desligamentos importados), pronto para contar o efetivo de qualquer data. Tolerante: sem a tabela de desligamentos, vale só o cadastro. */
export async function loadPresence(): Promise<{ people: Presence[]; unplaced: number; firstExit: Date | null }> {
  const collaborators = await db.collaborator.findMany({ select: { id: true, active: true, admissionDate: true, inactivatedAt: true } });
  let terminations: { collaboratorId: string | null; admissionDate: Date | null; terminationDate: Date }[] = [];
  try {
    terminations = await db.termination.findMany({ select: { collaboratorId: true, admissionDate: true, terminationDate: true } });
  } catch (error) {
    console.error("[turnover] desligamentos indisponíveis:", error);
  }
  const { people, unplaced } = buildPresence(collaborators, terminations);
  const firstExit = terminations.length ? new Date(Math.min(...terminations.map((t) => t.terminationDate.getTime()))) : null;
  return { people, unplaced, firstExit };
}
