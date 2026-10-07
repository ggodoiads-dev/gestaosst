"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { TableRow, TableCell } from "@/components/ui/table";
import { formatDate } from "@/lib/dates";
import { GUARDIAN_TYPE_LABELS } from "@/domain/guardian/labels";
import { GuardianReportDialog, type GuardianReportItem } from "../meu-perfil/guardian-report-row";

/** Linha da lista de relatos — clicar abre o detalhe completo, como o colaborador vê nos dele. */
export function GuardianReportTableRow({
  report,
  reporter,
  canOpenProfile,
}: {
  report: GuardianReportItem;
  reporter: { id: string; name: string } | null;
  canOpenProfile: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow clickable onClick={() => setOpen(true)}>
        <TableCell><Badge tone="info">{GUARDIAN_TYPE_LABELS[report.type]}</Badge></TableCell>
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
        </TableCell>
        <TableCell className="text-foreground-subtle">{report.occurredAt ? formatDate(report.occurredAt) : "—"}</TableCell>
        <TableCell className="text-foreground-subtle">{report.area ?? "—"}</TableCell>
        <TableCell className="text-foreground-subtle truncate max-w-xs">{report.categoryName ?? "—"}</TableCell>
      </TableRow>
      <GuardianReportDialog report={report} open={open} onOpenChange={setOpen} reporterName={reporter?.name ?? null} />
    </>
  );
}
