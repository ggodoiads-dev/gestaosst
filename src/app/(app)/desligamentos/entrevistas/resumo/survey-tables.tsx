import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import type { MotivosTempo, Satisfacao } from "@/domain/termination/survey";

const pct = (v: number | null) => (v === null ? "—" : `${v.toLocaleString("pt-BR")}%`);

/** Quanto maior o %, mais forte o fundo da célula. */
const shade = (v: number | null) => (v === null ? undefined : { backgroundColor: `color-mix(in srgb, var(--color-accent) ${Math.min(Math.round(v * 1.6), 60)}%, transparent)` });

export function MotivosTable({ data }: { data: MotivosTempo }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Motivo da saída</TableHead>
          {data.buckets.map((b) => (
            <TableHead key={b} className="text-right">
              {b}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.rows.map((r) => (
          <TableRow key={r.motivo}>
            <TableCell className="max-w-72">{r.motivo}</TableCell>
            {r.values.map((v, i) => (
              <TableCell key={i} className="text-right tabular-nums" style={shade(v)}>
                {pct(v)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function SatisfacaoTable({ data }: { data: Satisfacao }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Categoria</TableHead>
          <TableHead className="text-right">Satisfação</TableHead>
          <TableHead className="text-right">Itens críticos</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.rows.map((r) => (
          <TableRow key={r.categoria}>
            <TableCell>{r.categoria}</TableCell>
            <TableCell className="text-right tabular-nums">{pct(r.satisfacao)}</TableCell>
            <TableCell className="text-right tabular-nums">{pct(r.criticos)}</TableCell>
          </TableRow>
        ))}
        {data.total && (
          <TableRow>
            <TableCell className="font-semibold">Total</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{pct(data.total.satisfacao)}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{pct(data.total.criticos)}</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
