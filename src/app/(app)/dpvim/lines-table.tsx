import { dpvimKindLabel, type DpvimKindOption, type DpvimLine } from "@/domain/dpvim/rules";
import { Badge } from "@/components/ui/badge";

/** Os produtos de uma DPVIM, um por linha: o norte do conferente, o que os ajudantes contaram e, para quem vê a nota, a nota e a diferença. */
export function LinesTable({ lines, kinds, canSeeInvoice, concluded }: { lines: DpvimLine[]; kinds: DpvimKindOption[]; canSeeInvoice: boolean; concluded: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-surface-muted text-left text-xs text-foreground-subtle">
            <th className="px-3 py-2 font-semibold">Produto</th>
            <th className="px-3 py-2 text-right font-semibold">Norte do conferente</th>
            <th className="px-3 py-2 text-right font-semibold">Contado pelos ajudantes</th>
            <th className="px-3 py-2 font-semibold">Bons · transferência · descarte</th>
            {canSeeInvoice && <th className="px-3 py-2 text-right font-semibold">Nota</th>}
            {canSeeInvoice && <th className="px-3 py-2 font-semibold">Diferença</th>}
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.kind} className="border-t border-border">
              <td className="px-3 py-2 font-medium text-foreground">{dpvimKindLabel(l.kind, kinds)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-foreground-subtle">{l.expected > 0 ? l.expected : "—"}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{l.done}</td>
              <td className="px-3 py-2 text-xs tabular-nums text-foreground-subtle">
                {l.good + l.transfer + l.discard > 0 ? `${l.good} · ${l.transfer} · ${l.discard}` : "—"}
              </td>
              {canSeeInvoice && <td className="px-3 py-2 text-right tabular-nums">{l.invoice ?? <span className="text-foreground-subtle">—</span>}</td>}
              {canSeeInvoice && (
                <td className="px-3 py-2">
                  {l.balance === null ? (
                    <span className="text-xs text-foreground-subtle">{l.invoice === null ? "nota não informada" : concluded ? "" : "aguarda finalizar"}</span>
                  ) : l.balance === 0 ? (
                    <Badge tone="success">Bateu</Badge>
                  ) : l.balance < 0 ? (
                    <Badge tone="danger">Faltou {-l.balance}</Badge>
                  ) : (
                    <Badge tone="warning">Sobrou {l.balance}</Badge>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
