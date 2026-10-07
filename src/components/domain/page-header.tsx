import * as React from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border bg-surface px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-6 sm:py-4">
      <div className="min-w-0">
        <h1 className="text-base font-semibold text-foreground sm:text-lg">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-foreground-subtle">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
    </div>
  );
}

export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-4 p-3 sm:gap-5 sm:p-6 ${className ?? ""}`}>{children}</div>;
}
