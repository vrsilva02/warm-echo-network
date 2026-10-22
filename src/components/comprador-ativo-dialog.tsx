import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { chunk } from "@/lib/bulk-import";
import { logAction } from "@/lib/audit";
import { friendlyError } from "@/lib/errors";

export function CompradorAtivoDialog({ ids, currentValue, onDone, bulk = false }: {
  ids: string[];
  currentValue?: string | null;
  onDone?: () => void;
  bulk?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const uniqueIds = [...new Set(ids)];

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !uniqueIds.length) return;
    const comprador = value.trim();
    if (!comprador) {
      setError("Informe o comprador do ativo.");
      return;
    }
    setError(null);
    setBusy(true);
    const updated: string[] = [];
    try {
      for (const batch of chunk(uniqueIds, 100)) {
        const { data, error: updateError } = await supabase.from("ativos")
          .update({ comprador }).in("id", batch).select("id");
        if (updateError) throw updateError;
        updated.push(...(data ?? []).map((row) => row.id));
        if (data?.length !== batch.length) throw new Error("Alguns ativos não foram atualizados. Verifique suas permissões.");
      }
      toast.success(`${updated.length} ativo(s) com comprador atualizado.`);
      setOpen(false);
      onDone?.();
    } catch (err) {
      setError(`${updated.length} de ${uniqueIds.length} atualizado(s). ${friendlyError(err)}`);
    } finally {
      if (updated.length) {
        void logAction("BULK_UPDATE", "ativos", { operacao: "comprador", ids: updated, comprador, total: updated.length });
        for (const key of ["ativos", "ativo", "dashboard"]) {
          void qc.invalidateQueries({ queryKey: [key] });
        }
      }
      setBusy(false);
    }
  }

  return <>
    <Button size={bulk ? "sm" : "icon"} variant={bulk ? "outline" : "ghost"}
      className={bulk ? undefined : "h-7 w-7 shrink-0"}
      title={bulk ? "Comprador" : "Editar comprador"}
      aria-label={bulk ? "Comprador" : "Editar comprador"}
      disabled={!uniqueIds.length} onClick={() => {
        setValue(currentValue ?? "");
        setError(null);
        setOpen(true);
      }}>
      {bulk ? <><UserRound className="h-4 w-4" />Comprador</> : <Pencil className="h-3.5 w-3.5" />}
    </Button>
    <Dialog open={open} onOpenChange={(next) => { if (!busy) setOpen(next); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{bulk ? "Comprador em massa" : "Comprador do ativo"}</DialogTitle>
          <DialogDescription>{bulk ? `${uniqueIds.length} ativo(s) selecionado(s). O comprador informado substituirá o comprador atual de cada ativo selecionado.` : "Quem comprou o equipamento."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="comprador-ativo-update">Comprador</Label>
            <Input id="comprador-ativo-update" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Quem comprou o equipamento" required disabled={busy} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}