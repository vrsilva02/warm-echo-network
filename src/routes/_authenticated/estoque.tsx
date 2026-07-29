import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/combobox";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Boxes, PackagePlus, AlertTriangle, Download } from "lucide-react";
import { downloadXLSX } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/estoque")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Estoque de peças — GestoraIT" },
      { name: "description", content: "Saldo atual, reposição sugerida e movimentações de peças." },
    ],
  }),
});

type Saldo = {
  peca_id: string; nome: string; categoria: string; fabricante: string | null;
  estoque_minimo: number; custo_unitario: number | null; fornecedor_padrao: string | null; saldo: number;
};
type Reposicao = Saldo & { quantidade_sugerida: number };
type Movimentacao = {
  id: string; peca_id: string; tipo: "entrada" | "saida" | "ajuste";
  quantidade: number; custo_unitario: number | null; origem: string;
  observacao: string | null; ordem_servico_id: string | null; created_at: string;
  pecas_catalogo?: { nome: string } | null;
};

function toneFor(saldo: number, minimo: number): { tone: "ok" | "warn" | "danger"; label: string } {
  if (saldo < minimo) return { tone: "danger", label: "Abaixo do mínimo" };
  if (saldo <= minimo * 1.2) return { tone: "warn", label: "Próximo do mínimo" };
  return { tone: "ok", label: "OK" };
}
const toneCls = {
  ok: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
  warn: "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30",
  danger: "bg-destructive/15 text-destructive border-destructive/30",
};

function Page() {
  const { canWrite } = useAuth();
  const [movOpen, setMovOpen] = useState(false);

  const { data: saldo } = useQuery({
    queryKey: ["vw_estoque_saldo"],
    queryFn: async () => ((await (supabase as any).from("vw_estoque_saldo").select("*").order("nome")).data ?? []) as Saldo[],
  });
  const { data: reposicao } = useQuery({
    queryKey: ["vw_pecas_reposicao"],
    queryFn: async () => ((await (supabase as any).from("vw_pecas_reposicao").select("*").order("nome")).data ?? []) as Reposicao[],
  });
  const { data: movs } = useQuery({
    queryKey: ["estoque_movimentacoes"],
    queryFn: async () => ((await (supabase as any)
      .from("estoque_movimentacoes")
      .select("*, pecas_catalogo(nome)")
      .order("created_at", { ascending: false })
      .limit(500)).data ?? []) as Movimentacao[],
  });

  function exportarLista() {
    const cols = ["Peça", "Categoria", "Fabricante", "Fornecedor padrão", "Saldo atual", "Estoque mínimo", "Qtde. sugerida", "Custo unitário (R$)", "Estimativa total (R$)"];
    const rows = (reposicao ?? []).map((r) => [
      r.nome, r.categoria, r.fabricante ?? "", r.fornecedor_padrao ?? "",
      r.saldo, r.estoque_minimo, r.quantidade_sugerida,
      r.custo_unitario ?? "",
      r.custo_unitario ? (Number(r.custo_unitario) * r.quantidade_sugerida).toFixed(2) : "",
    ]);
    downloadXLSX(`lista-compras-${new Date().toISOString().slice(0, 10)}.xlsx`, cols, rows);
  }

  return (
    <>
      <PageHeader
        title="Estoque de peças"
        description="Saldo atual, reposição automática e histórico de movimentações."
        actions={canWrite ? <Button size="sm" onClick={() => setMovOpen(true)}><PackagePlus className="h-4 w-4 mr-1" /> Nova movimentação</Button> : undefined}
      />

      <Tabs defaultValue="saldo">
        <TabsList>
          <TabsTrigger value="saldo"><Boxes className="h-3 w-3 mr-1" /> Saldo atual</TabsTrigger>
          <TabsTrigger value="reposicao"><AlertTriangle className="h-3 w-3 mr-1" /> Reposição ({reposicao?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="movs">Movimentações</TabsTrigger>
        </TabsList>

        <TabsContent value="saldo" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Peça</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right">Mín.</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Fornecedor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(saldo ?? []).length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Nenhuma peça cadastrada.</TableCell></TableRow>
                  ) : (saldo ?? []).map((s) => {
                    const t = toneFor(s.saldo, s.estoque_minimo);
                    return (
                      <TableRow key={s.peca_id}>
                        <TableCell className="font-medium">{s.nome}</TableCell>
                        <TableCell><Badge variant="outline">{s.categoria}</Badge></TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{s.saldo}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{s.estoque_minimo}</TableCell>
                        <TableCell><Badge variant="outline" className={toneCls[t.tone]}>{t.label}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{s.fornecedor_padrao ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reposicao" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {reposicao?.length ?? 0} peça(s) em ponto de reposição. Quantidade sugerida = dobro do estoque mínimo menos o saldo atual.
            </p>
            <Button size="sm" variant="outline" onClick={exportarLista} disabled={!reposicao?.length}>
              <Download className="h-4 w-4 mr-1" /> Gerar lista de compra (XLSX)
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Peça</TableHead>
                    <TableHead>Fornecedor padrão</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right">Mín.</TableHead>
                    <TableHead className="text-right">Sugerir</TableHead>
                    <TableHead className="text-right">Estimativa (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(reposicao ?? []).length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Tudo dentro do estoque mínimo.</TableCell></TableRow>
                  ) : reposicao!.map((r) => (
                    <TableRow key={r.peca_id}>
                      <TableCell className="font-medium">{r.nome}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.fornecedor_padrao ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums text-destructive font-semibold">{r.saldo}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{r.estoque_minimo}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{r.quantidade_sugerida}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.custo_unitario ? `R$ ${(Number(r.custo_unitario) * r.quantidade_sugerida).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movs" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Últimas 500 movimentações</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Peça</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Qtde.</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Observação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(movs ?? []).length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Sem movimentações registradas.</TableCell></TableRow>
                  ) : movs!.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs">{new Date(m.created_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="font-medium">{m.pecas_catalogo?.nome ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          m.tipo === "entrada" ? toneCls.ok :
                          m.tipo === "saida" ? toneCls.danger : ""
                        }>{m.tipo}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {m.tipo === "saida" ? "-" : "+"}{m.quantidade}
                      </TableCell>
                      <TableCell>
                        {m.origem === "auto_os" ? (
                          <Badge variant="secondary" className="text-[10px]">automática (OS)</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">manual</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.observacao ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <NovaMovDialog open={movOpen} onOpenChange={setMovOpen} />
    </>
  );
}

function NovaMovDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [pecaId, setPecaId] = useState<string | null>(null);
  const [tipo, setTipo] = useState<"entrada" | "ajuste">("entrada");
  const [qtd, setQtd] = useState(0);
  const [custo, setCusto] = useState("");
  const [obs, setObs] = useState("");
  const { data: pecas } = useQuery({
    queryKey: ["pecas-lite"],
    enabled: open,
    queryFn: async () => ((await (supabase as any).from("pecas_catalogo").select("id, nome, custo_unitario").order("nome")).data ?? []) as Array<{ id: string; nome: string; custo_unitario: number | null }>,
  });
  const opts = useMemo(() => (pecas ?? []).map((p) => ({ value: p.id, label: p.nome })), [pecas]);

  function reset() { setPecaId(null); setTipo("entrada"); setQtd(0); setCusto(""); setObs(""); }
  async function salvar() {
    if (!pecaId || !qtd) return toast.error("Selecione a peça e a quantidade.");
    const { error } = await (supabase as any).from("estoque_movimentacoes").insert({
      peca_id: pecaId, tipo, quantidade: Number(qtd), custo_unitario: custo ? Number(custo) : null,
      observacao: obs || null, origem: "manual",
    });
    if (error) return toast.error(error.message);
    toast.success("Movimentação registrada");
    qc.invalidateQueries({ queryKey: ["vw_estoque_saldo"] });
    qc.invalidateQueries({ queryKey: ["vw_pecas_reposicao"] });
    qc.invalidateQueries({ queryKey: ["estoque_movimentacoes"] });
    reset(); onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova movimentação de estoque</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Peça *</Label>
            <Combobox value={pecaId} onChange={setPecaId} options={opts} placeholder="Selecionar peça…" searchPlaceholder="Buscar peça…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo *</Label>
              <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
                <option value="entrada">Entrada (compra)</option>
                <option value="ajuste">Ajuste de inventário</option>
              </select>
              <p className="text-[10px] text-muted-foreground mt-1">Saídas são geradas automaticamente pelas OS.</p>
            </div>
            <div><Label>Quantidade *</Label><Input type="number" min={1} value={qtd} onChange={(e) => setQtd(Number(e.target.value))} /></div>
          </div>
          <div><Label>Custo unitário (R$)</Label><Input type="number" step="0.01" value={custo} onChange={(e) => setCusto(e.target.value)} /></div>
          <div><Label>Observação</Label><Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar}>Registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
