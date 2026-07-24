import type { ReactNode } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Circle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusTone = "ok" | "warn" | "critical" | "neutral" | "info";

const toneClass: Record<StatusTone, string> = {
  ok: "bg-status-ok text-status-ok-foreground",
  warn: "bg-status-warn text-status-warn-foreground",
  critical: "bg-status-critical text-status-critical-foreground",
  neutral: "bg-status-neutral text-status-neutral-foreground",
  info: "bg-primary/10 text-primary",
};

const defaultIcon: Record<StatusTone, ReactNode> = {
  ok: <CheckCircle2 className="h-3 w-3" />,
  warn: <AlertTriangle className="h-3 w-3" />,
  critical: <XCircle className="h-3 w-3" />,
  neutral: <Circle className="h-3 w-3" />,
  info: <Clock className="h-3 w-3" />,
};

export function StatusPill({
  tone = "neutral",
  icon,
  children,
  className,
}: {
  tone?: StatusTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap",
        toneClass[tone],
        className,
      )}
    >
      {icon ?? defaultIcon[tone]}
      {children}
    </span>
  );
}
