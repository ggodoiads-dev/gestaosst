import type { EquipmentStatus } from "@/generated/prisma/enums";

/** Equipamento retido: só sai disso quando o sistema libera de verdade (manutenção concluída ou correção validada), nunca por um checklist. */
export function isHeldForRelease(status: EquipmentStatus): boolean {
  return status === "BLOQUEADO" || status === "EM_MANUTENCAO";
}

const LOOSER_THAN_RESTRITO: EquipmentStatus[] = ["LIBERADO", "LIBERADO_COM_OBSERVACAO"];

/**
 * Status do equipamento depois de um checklist finalizado. O checklist pode PIORAR o status (bloquear, restringir), mas nunca LIBERAR sozinho
 * quem está bloqueado, em manutenção ou restrito — antes, um checklist sem desvios mandava "LIBERADO" por cima da manutenção em andamento.
 */
export function statusAfterChecklist(previous: EquipmentStatus, proposed: EquipmentStatus): EquipmentStatus {
  if (previous === "BLOQUEADO" || previous === "EM_MANUTENCAO" || previous === "INATIVO") return previous;
  if (previous === "RESTRITO" && LOOSER_THAN_RESTRITO.includes(proposed)) return previous;
  return proposed;
}
