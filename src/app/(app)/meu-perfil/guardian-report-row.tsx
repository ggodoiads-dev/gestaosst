"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from "@/components/ui/dialog";
import { formatDate, formatDateTime } from "@/lib/dates";
import { GUARDIAN_TYPE_LABELS } from "@/domain/guardian/labels";
import type { GuardianReportType } from "@/generated/prisma/enums";

type GuardianReportItem = {
  id: string;
  guardianId: string;
  type: GuardianReportType;
  categoryName: string | null;
  description: string | null;
  occurredAt: Date | null;
  reportedAt: Date | null;
  unit: string | null;
  area: string | null;
  subArea: string | null;
  location: string | null;
  equipment: string | null;
  isAnonymous: boolean;
};

export function GuardianReportRow({ report }: { report: GuardianReportItem }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-start justify-between gap-3 rounded-md border border-border px-3 py-2.5 text-sm text-left hover:bg-surface-muted hover:border-border-strong transition-colors"
      >
        <div className="min-w-0">
          <p className="truncate">{report.categoryName ?? GUARDIAN_TYPE_LABELS[report.type]}</p>
          <p className="text-xs text-foreground-subtle">{report.occurredAt ? formatDate(report.occurredAt) : "—"}</p>
        </div>
        <Badge tone="info">{GUARDIAN_TYPE_LABELS[report.type]}</Badge>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{report.categoryName ?? GUARDIAN_TYPE_LABELS[report.type]}</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Badge tone="info">{GUARDIAN_TYPE_LABELS[report.type]}</Badge>
              {report.isAnonymous && <Badge tone="neutral">Relatado anônimo</Badge>}
            </div>

            {report.description && (
              <div>
                <p className="text-xs text-foreground-subtle">Descrição</p>
                <p className="whitespace-pre-wrap text-foreground-muted">{report.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-foreground-subtle">Ocorreu em</p>
                <p>{report.occurredAt ? formatDateTime(report.occurredAt) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">Relatado em</p>
                <p>{report.reportedAt ? formatDateTime(report.reportedAt) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">Unidade</p>
                <p>{report.unit ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">Área</p>
                <p>{report.area ?? "—"}{report.subArea ? ` — ${report.subArea}` : ""}</p>
              </div>
              {report.location && (
                <div>
                  <p className="text-xs text-foreground-subtle">Local</p>
                  <p>{report.location}</p>
                </div>
              )}
              {report.equipment && (
                <div>
                  <p className="text-xs text-foreground-subtle">Equipamento</p>
                  <p>{report.equipment}</p>
                </div>
              )}
            </div>

            <p className="font-mono text-xs text-foreground-subtle">Guardian: {report.guardianId}</p>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}
