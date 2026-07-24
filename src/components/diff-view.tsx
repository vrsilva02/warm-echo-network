import type { ReactNode } from "react";

function fmt(v: any) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function DiffView({
  before,
  after,
  onlyChanged = false,
}: {
  before: any;
  after: any;
  onlyChanged?: boolean;
}) {
  const keys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])).sort();
  const changed = (k: string) => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]);

  const row = (k: string, cells: ReactNode) => (
    <div
      key={k}
      className={`grid grid-cols-[160px_1fr_1fr] gap-2 border-b border-border/40 py-1 ${
        before && after && changed(k) ? "bg-warning/5" : ""
      }`}
    >
      <span className="text-muted-foreground font-mono text-xs">{k}</span>
      {cells}
    </div>
  );

  if (!before && after) {
    return (
      <div className="space-y-1 text-sm">
        {keys.map((k) => (
          <div key={k} className="grid grid-cols-[160px_1fr] gap-2 border-b border-border/40 py-1">
            <span className="text-muted-foreground font-mono text-xs">{k}</span>
            <span className="text-success">{fmt(after?.[k])}</span>
          </div>
        ))}
      </div>
    );
  }
  if (before && !after) {
    return (
      <div className="space-y-1 text-sm">
        {keys.map((k) => (
          <div key={k} className="grid grid-cols-[160px_1fr] gap-2 border-b border-border/40 py-1">
            <span className="text-muted-foreground font-mono text-xs">{k}</span>
            <span className="text-destructive line-through">{fmt(before?.[k])}</span>
          </div>
        ))}
      </div>
    );
  }
  const visible = onlyChanged ? keys.filter(changed) : keys;
  if (visible.length === 0) {
    return <div className="text-xs text-muted-foreground py-2">Nenhum campo alterado.</div>;
  }
  return (
    <div className="space-y-1 text-sm">
      {visible.map((k) =>
        row(
          k,
          <>
            <span className={changed(k) ? "text-destructive line-through" : ""}>{fmt(before?.[k])}</span>
            <span className={changed(k) ? "text-success" : ""}>{fmt(after?.[k])}</span>
          </>,
        ),
      )}
    </div>
  );
}
