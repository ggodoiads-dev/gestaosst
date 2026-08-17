import type { BadgeTone } from "@/components/ui/badge";
import { formatDate } from "@/lib/dates";

export function qualificationStatus(expiresAt: Date | null): { label: string; tone: BadgeTone } {
  if (!expiresAt) return { label: "Sem vencimento", tone: "success" };
  const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return { label: `Vencida em ${formatDate(expiresAt)}`, tone: "danger" };
  if (daysLeft <= 30) return { label: `Vence em ${formatDate(expiresAt)}`, tone: "warning" };
  return { label: `Válida até ${formatDate(expiresAt)}`, tone: "success" };
}
