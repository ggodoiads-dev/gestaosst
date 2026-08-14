/** Gera códigos amigáveis como PE-001, NC-000001, EXE-000001 (seção 59 do documento). */
export function formatFriendlyCode(prefix: string, sequence: number, digits = 6): string {
  return `${prefix}-${String(sequence).padStart(digits, "0")}`;
}
