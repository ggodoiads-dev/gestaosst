import { Sparkles } from "lucide-react";
import type { CurrentUser } from "@/server/auth/current-user";
import { getAccidentInsight } from "@/server/services/rico.service";
import { RicoAvatar } from "@/components/rico/rico-avatar";
import type { AccidentMonthlyStats } from "@/server/services/accident.service";

export function AccidentInsightSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-muted px-4 py-3">
      <div className="size-8 shrink-0 animate-pulse rounded-full bg-border" />
      <div className="flex-1 space-y-2">
        <div className="h-2.5 w-16 animate-pulse rounded bg-border" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-border" />
      </div>
    </div>
  );
}

export async function AccidentInsightCard({ user, stats }: { user: CurrentUser; stats: AccidentMonthlyStats }) {
  const insight = await getAccidentInsight(user, {
    year: stats.year,
    totalCount: stats.totalCount,
    monthly: stats.monthly,
    topType: stats.topType,
  });
  if (!insight) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-muted px-4 py-3">
      <div className="size-8 shrink-0">
        <RicoAvatar state="idle" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-accent">
          <Sparkles className="size-3" /> Rico
        </p>
        <p className="mt-0.5 text-sm leading-relaxed text-foreground">{insight}</p>
      </div>
    </div>
  );
}
