import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConfirmImpactItem = { label: string; value: React.ReactNode; tone?: "default" | "warn" | "danger" };

export type ConfirmOptions = {
  title: string;
  description?: React.ReactNode;
  /** Lista de impactos previstos (mostrada em destaque). */
  impact?: ConfirmImpactItem[];
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger => botão destrutivo. warn => atenção. default => primário. */
  tone?: "danger" | "warn" | "default";
};

type Ctx = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
};

const ConfirmCtx = React.createContext<Ctx | null>(null);

export function useConfirm() {
  const ctx = React.useContext(ConfirmCtx);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx.confirm;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [opts, setOpts] = React.useState<ConfirmOptions | null>(null);
  const resolverRef = React.useRef<((v: boolean) => void) | null>(null);
  const [pending, setPending] = React.useState(false);

  const confirm = React.useCallback((o: ConfirmOptions) => {
    setOpts(o);
    setOpen(true);
    setPending(false);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  function close(result: boolean) {
    setOpen(false);
    const r = resolverRef.current;
    resolverRef.current = null;
    setTimeout(() => r?.(result), 0);
  }

  const tone = opts?.tone ?? "default";
  const btnClass = cn(
    tone === "danger" && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    tone === "warn" && "bg-[color:var(--warning)] text-white hover:brightness-95",
  );

  return (
    <ConfirmCtx.Provider value={{ confirm }}>
      {children}
      <AlertDialog open={open} onOpenChange={(v) => { if (!v && !pending) close(false); }}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {tone !== "default" && (
                <AlertTriangle className={cn("h-5 w-5", tone === "danger" ? "text-destructive" : "text-[color:var(--warning)]")} />
              )}
              {opts?.title}
            </AlertDialogTitle>
            {opts?.description && (
              <AlertDialogDescription asChild>
                <div className="text-sm text-muted-foreground">{opts.description}</div>
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>

          {opts?.impact && opts.impact.length > 0 && (
            <div className="rounded-md border bg-muted/40 p-3 space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Impacto previsto</div>
              <ul className="text-sm space-y-1">
                {opts.impact.map((it, i) => (
                  <li key={i} className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">{it.label}</span>
                    <span className={cn(
                      "font-medium tabular-nums",
                      it.tone === "warn" && "text-[color:var(--warning)]",
                      it.tone === "danger" && "text-destructive",
                    )}>{it.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{opts?.cancelLabel ?? "Cancelar"}</AlertDialogCancel>
            <AlertDialogAction
              className={btnClass}
              disabled={pending}
              onClick={(e) => { e.preventDefault(); setPending(true); close(true); }}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {opts?.confirmLabel ?? "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmCtx.Provider>
  );
}
