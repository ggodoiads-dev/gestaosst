"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatDate, parseDateOnly } from "@/lib/dates";
import { ProductivityDayDialog } from "./productivity-day-dialog";
import type { Activity } from "@/generated/prisma/client";

type EntryData = {
  id: string;
  quantity: number | null;
  notes: string | null;
  activity: Activity;
};

type DayData = {
  date: string; // yyyy-mm-dd
  day: number;
  weekday: string;
  status: "TRABALHO" | "FOLGA";
  entries: EntryData[];
};

export function ProductivityCalendarClient({
  collaboratorId,
  collaboratorName,
  days,
  activities,
  layout = "grid",
}: {
  collaboratorId: string;
  collaboratorName: string;
  days: DayData[];
  activities: Activity[];
  layout?: "grid" | "list";
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const selectedDay = days.find((d) => d.date === selectedDate) ?? null;

  return (
    <>
      {layout === "grid" ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted">
                {days.map((d) => (
                  <th key={d.date} className="px-1.5 py-1 text-center text-[11px] font-medium text-foreground-subtle">
                    <div>{d.day}</div>
                    <div className="font-normal text-foreground-subtle/70">{d.weekday}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {days.map((d) => {
                  const isWork = d.status === "TRABALHO";
                  return (
                    <td key={d.date} className="px-1 py-1.5 text-center">
                      <button
                        type="button"
                        disabled={!isWork}
                        onClick={() => setSelectedDate(d.date)}
                        className={cn(
                          "mx-auto flex h-9 w-9 flex-col items-center justify-center gap-0.5 rounded text-[10px] font-semibold transition-opacity",
                          isWork
                            ? "bg-success-soft text-success hover:opacity-75 cursor-pointer"
                            : "bg-neutral-soft text-foreground-subtle cursor-not-allowed",
                        )}
                      >
                        {isWork ? "T" : "F"}
                        {d.entries.length > 0 && <span className="size-1.5 rounded-full bg-accent" />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {days.map((d) => {
            const isWork = d.status === "TRABALHO";
            const missing = isWork && d.entries.length === 0;
            return (
              <button
                key={d.date}
                type="button"
                disabled={!isWork}
                onClick={() => setSelectedDate(d.date)}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-left text-sm transition-colors",
                  isWork ? "hover:bg-surface-muted cursor-pointer" : "opacity-60 cursor-not-allowed",
                )}
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {d.weekday} — {formatDate(parseDateOnly(d.date))}
                  </p>
                  <p className="truncate text-xs text-foreground-subtle">
                    {!isWork
                      ? "Folga"
                      : d.entries.length > 0
                        ? d.entries.map((e) => e.activity.name).join(", ")
                        : "Nenhum lançamento"}
                  </p>
                </div>
                <Badge tone={!isWork ? "neutral" : missing ? "danger" : "success"}>
                  {!isWork ? "Folga" : missing ? "Não lançou" : `${d.entries.length} lançamento${d.entries.length > 1 ? "s" : ""}`}
                </Badge>
              </button>
            );
          })}
        </div>
      )}

      {selectedDay && (
        <ProductivityDayDialog
          collaboratorId={collaboratorId}
          collaboratorName={collaboratorName}
          date={selectedDay.date}
          entries={selectedDay.entries}
          activities={activities}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </>
  );
}
