import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";

export { EmptyState } from "@/components/empty-state";

export function PageHeader({
  title,
  description,
  actions,
  showBreadcrumbs = true,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  showBreadcrumbs?: boolean;
}) {
  return (
    <div className="mb-6 space-y-2">
      {showBreadcrumbs && <Breadcrumbs />}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
    </div>
  );
}
