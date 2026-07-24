import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";

export function CrudDialog({
  title,
  trigger,
  children,
  onSubmit,
  open: openProp,
  onOpenChange,
  submitLabel = "Salvar",
}: {
  title: string;
  trigger?: ReactNode;
  children: ReactNode;
  onSubmit: () => Promise<void> | void;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  submitLabel?: string;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== undefined ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button size="sm">
            <Plus className="h-4 w-4" /> Novo
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await onSubmit();
              setOpen(false);
            } finally {
              setBusy(false);
            }
          }}
        >
          {children}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
