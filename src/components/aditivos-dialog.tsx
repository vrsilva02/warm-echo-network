import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill } from "@/components/status-pill";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Plus } from "lucide-react";

type Aditivo = {
  id: string;
  contrato_id: string;
  numero: string;
  tipo: "quantidade" | "prazo" | "valor" | "outro";
  delta_seats: number | null;
  delta_valor: number | null;
  nova_data_fim: string | null;
  descricao: string | null;
  created_at: string;
};

export function AditivosDialog({
  contratoId,
  contratoLabel,
  open,
  onOpenChange,
}: {
  contratoId: string | null;
  contratoLabel: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { canWrite, user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<{
    numero: string;
    tipo: Aditivo["tipo"];
    delta_seats: string;
    delta_valor: string;
    nova_data_fim: string;
    descricao: string;
  }>({ numero: "", tipo: "quantidade", delta_seats: "", delta_valor: "", nova_data_fim: "", descricao: "" });

  const { data: aditivos } = useQuery({
    queryKey: ["aditivos", contratoId],
    enabled: !!contratoId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos_aditivos")
        .select("*")
        .eq("contrato_id", contratoId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Aditivo[];
    },
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!contratoId) return;
    if (!form.numero.trim()) return toast.error("Informe o número do aditivo");
    const payload = {
      contrato_id: contratoId,
      numero: form.numero.trim(),
      tipo: form.tipo,
      delta_seats: form.tipo === "quantidade" ? Number(form.delta_seats) || 0 : 0,
      delta_valor: form.tipo === "valor" ? Number(form.delta_valor) || 0 : 0,
      nova_data_fim: form.tipo === "prazo" && form.nova_data_fim ? form.nova_data_fim : null,
      descricao: form.descricao || null,
      criado_por: user?.id ?? null,
    };
    const { error } = await supabase.from("contratos_aditivos").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Aditivo registrado");
    setForm({ numero: "", tipo: "quantidade", delta_seats: "", delta_valor: "", nova_data_fim: "", descricao: "" });
    qc.invalidateQueries({ queryKey: ["aditivos", contratoId] });
    qc.invalidateQueries({ queryKey: ["contratos"] });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Aditivos — {contratoLabel}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-64 overflow-auto rounded-md border p-2">
          {(aditivos ?? []).length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-6">Nenhum aditivo registrado.</div>
          ) : (
            aditivos!.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3 text-xs border-b last:border-b-0 pb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Nº {a.numero}</span>
                    <StatusPill tone="info">{a.tipo}</StatusPill>
                  </div>
                  <div className="text-muted-foreground mt-0.5">
                    {a.tipo === "quantidade" && `Δ seats: ${a.delta_seats}`}
                    {a.tipo === "valor" && `Δ valor: R$ ${(a.delta_valor ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                    {a.tipo === "prazo" && `Nova data fim: ${a.nova_data_fim ?? "—"}`}
                    {a.descricao && ` · ${a.descricao}`}
                  </div>
                </div>
                <div className="text-muted-foreground whitespace-nowrap">
                  {new Date(a.created_at).toLocaleDateString("pt-BR")}
                </div>
              </div>
            ))
          )}
        </div>

        {canWrite && (
          <form onSubmit={submit} className="space-y-3 border-t pt-3">
            <div className="text-xs font-medium flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Novo aditivo</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Número *</Label>
                <Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} required />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v: Aditivo["tipo"]) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quantidade">Quantidade (seats)</SelectItem>
                    <SelectItem value="prazo">Prazo</SelectItem>
                    <SelectItem value="valor">Valor</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.tipo === "quantidade" && (
              <div>
                <Label>Variação de seats (positiva ou negativa)</Label>
                <Input type="number" value={form.delta_seats} onChange={(e) => setForm({ ...form, delta_seats: e.target.value })} />
              </div>
            )}
            {form.tipo === "valor" && (
              <div>
                <Label>Variação de valor (R$)</Label>
                <Input type="number" step="0.01" value={form.delta_valor} onChange={(e) => setForm({ ...form, delta_valor: e.target.value })} />
              </div>
            )}
            {form.tipo === "prazo" && (
              <div>
                <Label>Nova data de término</Label>
                <Input type="date" value={form.nova_data_fim} onChange={(e) => setForm({ ...form, nova_data_fim: e.target.value })} />
              </div>
            )}
            <div>
              <Label>Descrição</Label>
              <Textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm">Registrar aditivo</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
