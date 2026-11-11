"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TableRow, TableCell } from "@/components/ui/table";
import { formatWallClockDateTime } from "@/lib/dates";
import { GUARDIAN_TYPE_LABELS } from "@/domain/guardian/labels";
import { GuardianReportDialog, type GuardianReportItem } from "../meu-perfil/guardian-report-row";

/** Linha da lista de relatos — clicar abre o detalhe completo, como o colaborador vê nos dele. */
export function GuardianReportTableRow({
  report,
  reporter,
  canOpenProfile,
  isLeader = false,
  goldenRule = false,
  goldenStatus = null,
}: {
  report: GuardianReportItem;
  reporter: { id: string; name: string } | null;
  canOpenProfile: boolean;
  isLeader?: boolean;
  goldenRule?: boolean;
  /** Conclusão da Regra de Ouro (nulo = pendente). */
  goldenStatus?: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow clickable onClick={() => setOpen(true)} className={goldenRule ? "bg-danger-soft/40" : undefined}>
        <TableCell>
          <div className="flex flex-wrap items-center gap-1">
            <Badge tone="info">{GUARDIAN_TYPE_LABELS[report.type]}</Badge>
            {goldenRule && (
              <Badge tone={goldenStatus ? "neutral" : "danger"}>
                <ShieldAlert className="size-3" /> Regra de Ouro{goldenStatus ? ` · ${goldenStatus}` : " · pendente"}
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell>
          {reporter ? (
            canOpenProfile ? (
              <Link
                href={`/colaboradores/${reporter.id}`}
                className="text-accent hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {reporter.name}
              </Link>
            ) : (
              reporter.name
            )
          ) : (
            "—"
          )}
          {reporter && <Badge tone={isLeader ? "accent" : "neutral"} className="ml-2">{isLeader ? "Liderança" : "Operação"}</Badge>}
        </TableCell>
        <TableCell className="text-foreground-subtle">{report.occurredAt ? formatWallClockDateTime(report.occurredAt) : "—"}</TableCell>
        <TableCell className="text-foreground-subtle">{report.area ?? "—"}</TableCell>
        <TableCell className="text-foreground-subtle truncate max-w-xs">{report.categoryName ?? "—"}</TableCell>
      </TableRow>
      <GuardianReportDialog report={report} open={open} onOpenChange={setOpen} reporterName={reporter?.name ?? null} />
    </>
  );
}
