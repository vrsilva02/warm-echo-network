import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";

export { EmptyState } from "@/components/empty-state";

export function PageHeader({
  title,
  description,
  actions,
  showBreadcrumbs = true,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  showBreadcrumbs?: boolean;
}) {
  return (
    <div className="mb-7 space-y-3 border-b border-border/60 pb-5">
      {showBreadcrumbs && <Breadcrumbs />}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[1.5rem] sm:text-[1.75rem] font-semibold tracking-[-0.03em] leading-tight text-balance">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl leading-relaxed text-pretty">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
