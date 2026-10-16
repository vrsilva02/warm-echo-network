import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Coins, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { parseValorAquisicao } from "@/lib/valor-aquisicao";
import { chunk } from "@/lib/bulk-import";
import { logAction } from "@/lib/audit";
import { friendlyError } from "@/lib/errors";

export function ValorAquisicaoDialog({ ids, currentValue, onDone, bulk = false }: {
  ids: string[];
  currentValue?: number | null;
  onDone?: () => void;
  bulk?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let amount: number | null;
    try {
      amount = parseValorAquisicao(value);
      if (amount === null) throw new Error("Informe o valor de aquisição.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Valor inválido.");
      return;
    }
    setBusy(true);
    const updated: string[] = [];
    try {
      for (const batch of chunk([...new Set(ids)], 100)) {
        const { data, error: updateError } = await supabase.from("ativos")
          .update({ valor_aquisicao: amount }).in("id", batch).select("id");
        if (updateError) throw updateError;
        updated.push(...(data ?? []).map((row) => row.id));
        if (data?.length !== batch.length) throw new Error("Alguns ativos não foram atualizados. Verifique suas permissões.");
      }
      toast.success(`${updated.length} ativo(s) com valor de aquisição atualizado.`);
      setOpen(false);
      onDone?.();
    } catch (err) {
      setError(`${updated.length} de ${ids.length} atualizado(s). ${friendlyError(err)}`);
    } finally {
      if (updated.length) {
        void logAction("BULK_UPDATE", "ativos", { operacao: "valor_aquisicao", ids: updated, valor_aquisicao: amount, total: updated.length });
        for (const key of ["ativos", "ativo", "vw_tco_ativo", "dashboard"]) {
          void qc.invalidateQueries({ queryKey: [key] });
        }
      }
      setBusy(false);
    }
  }

  return <>
    <Button size="sm" variant="outline" disabled={!ids.length} onClick={() => {
      setValue(currentValue == null ? "" : currentValue.toFixed(2).replace(".", ","));
      setError(null);
      setOpen(true);
    }}><Coins className="h-4 w-4" />{bulk ? "Valor de aquisição" : "Editar valor de aquisição"}</Button>
    <Dialog open={open} onOpenChange={(next) => { if (!busy) setOpen(next); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{bulk ? "Valor de aquisição em massa" : "Valor de aquisição"}</DialogTitle>
          <DialogDescription>{bulk ? `${ids.length} ativo(s) selecionado(s). O valor informado substituirá o valor de compra de cada equipamento selecionado.` : "Valor pago na compra do equipamento."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="valor-aquisicao-update">Valor de aquisição por equipamento (R$)</Label>
            <Input id="valor-aquisicao-update" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0,00" required disabled={busy} />
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