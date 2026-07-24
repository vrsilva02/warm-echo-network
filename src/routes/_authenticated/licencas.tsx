import { createFileRoute } from "@tanstack/react-router";
// (Dialog imported below)
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import * as React from "react";
import { EmptyState } from "@/components/empty-state";
import { Combobox } from "@/components/combobox";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { KeyRound, ArrowLeft, Plus, Link2, Unlink, Pencil, Trash2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useConfirm } from "@/components/confirm-dialog";
import { logAction } from "@/lib/audit";
import { encerrarAlocacao, encerrarAlocacoes, criarAlocacao } from "@/lib/licencas";

export const Route = createFileRoute("/_authenticated/licencas")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Licenças — ITAM/SAM" },
      { name: "description", content: "Painel de licenças por categoria, produto e atribuição." },
    ],
  }),
});

type ElpRow = {
  produto_id: string;
  nome_oficial: string;
  categoria: string;
  fabricante: string | null;
  subtipo?: string | null;
  licencas_compradas: number;
  licencas_alocadas: number;
  saldo: number;
};

type ProdutoAgg = ElpRow & { subtipo: string | null };

function Page() {
  const { canWrite } = useAuth();

  const { data: produtos, isLoading } = useQuery({
    queryKey: ["licencas-produtos-agg"],
    queryFn: async () => {
      // vw_elp já traz totais por produto. Complemento com subtipo do catálogo.
      const [{ data: elp, error: e1 }, { data: cat, error: e2 }] = await Promise.all([
        supabase.from("vw_elp").select("*"),
        supabase.from("produtos_catalogo").select("id, subtipo"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const subByProd = new Map((cat ?? []).map((c: any) => [c.id, c.subtipo as string | null]));
      return (elp ?? []).map((r: any) => ({
        ...r,
        subtipo: subByProd.get(r.produto_id) ?? null,
      })) as ProdutoAgg[];
    },
  });

  const categorias = useMemo(() => {
    const set = new Set<string>();
    (produtos ?? []).forEach((p) => set.add(p.categoria || "Outro"));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [produtos]);

  const [tab, setTab] = useState<string>("todas");
  const [selectedProdId, setSelectedProdId] = useState<string | null>(null);
  const [newLicOpen, setNewLicOpen] = useState(false);
  const [editingLicId, setEditingLicId] = useState<string | null>(null);
  const [defaultCategoria, setDefaultCategoria] = useState<string | null>(null);

  const selected = produtos?.find((p) => p.produto_id === selectedProdId) ?? null;

  return (
    <>
      <PageHeader
        title="Licenças"
        description="Visão por categoria e SKU, atribuições ativas e histórico."
        actions={
          canWrite ? (
            <Button size="sm" onClick={() => { setEditingLicId(null); setDefaultCategoria(tab === "todas" ? null : tab); setNewLicOpen(true); }}>
              <Plus className="h-4 w-4" /> Nova licença
            </Button>
          ) : undefined
        }
      />

      {selected ? (
        <ProductDetail
          produto={selected}
          onBack={() => setSelectedProdId(null)}
          canWrite={canWrite}
        />
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="todas">Todas</TabsTrigger>
            {categorias.map((c) => (
              <TabsTrigger key={c} value={c}>{c}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="todas" className="mt-4">
            <ProductGrid rows={produtos ?? []} isLoading={isLoading} onSelect={setSelectedProdId} />
          </TabsContent>
          {categorias.map((c) => (
            <TabsContent key={c} value={c} className="mt-4">
              <ProductGrid rows={(produtos ?? []).filter((p) => p.categoria === c)} isLoading={isLoading} onSelect={setSelectedProdId} />
            </TabsContent>
          ))}
        </Tabs>
      )}

      <LicencaDialog
        open={newLicOpen}
        onOpenChange={setNewLicOpen}
        licencaId={editingLicId}
        defaultCategoria={defaultCategoria}
      />
    </>
  );
}

/* ------------------------- Grid de cards por produto ------------------------- */

function ProductGrid({
  rows,
  isLoading,
  onSelect,
}: {
  rows: ProdutoAgg[];
  isLoading: boolean;
  onSelect: (id: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<KeyRound className="h-6 w-6" />}
        title="Sem produtos nesta categoria"
        description="Cadastre licenças ou produtos no catálogo para começar."
      />
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rows.map((r) => (
        <ProductCard key={r.produto_id} row={r} onSelect={onSelect} />
      ))}
    </div>
  );
}

function ProductCard({ row, onSelect }: { row: ProdutoAgg; onSelect: (id: string) => void }) {
  const total = row.licencas_compradas ?? 0;
  const usadas = row.licencas_alocadas ?? 0;
  const disponivel = total - usadas;
  const pct = total > 0 ? (usadas / total) * 100 : usadas > 0 ? 100 : 0;
  const tone = pct > 100
    ? "bg-destructive/15 text-destructive border-destructive/30"
    : pct >= 90
      ? "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30"
      : "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30";
  const barCls = pct > 100 ? "bg-destructive" : pct >= 90 ? "bg-[color:var(--warning)]" : "bg-[color:var(--success)]";
  const status = pct > 100 ? "déficit" : pct >= 90 ? "atenção" : "ok";

  return (
    <button
      onClick={() => onSelect(row.produto_id)}
      className="text-left rounded-lg border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{row.nome_oficial}</div>
          <div className="text-xs text-muted-foreground truncate">
            {row.fabricante ?? "—"} · {row.categoria}{row.subtipo ? ` · ${row.subtipo}` : ""}
          </div>
        </div>
        <Badge variant="outline" className={tone}>{status}</Badge>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center my-3">
        <div>
          <div className="text-lg font-semibold tabular-nums">{total}</div>
          <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Total</div>
        </div>
        <div>
          <div className="text-lg font-semibold tabular-nums">{usadas}</div>
          <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Atribuídas</div>
        </div>
        <div>
          <div className={`text-lg font-semibold tabular-nums ${disponivel < 0 ? "text-destructive" : ""}`}>{disponivel}</div>
          <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Disponível</div>
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${barCls}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground text-right tabular-nums">{pct.toFixed(0)}% de uso</div>
    </button>
  );
}

/* --------------------------- Detalhe do produto --------------------------- */

type AlocRow = {
  id: string;
  data_inicio: string | null;
  data_fim: string | null;
  observacao: string | null;
  licenca_id: string;
  ativos: { id: string; hostname: string } | null;
  usuarios: { id: string; nome: string } | null;
  licencas: { id: string; chave_ativacao: string | null; contrato_id: string | null } | null;
};

function ProductDetail({
  produto,
  onBack,
  canWrite,
}: {
  produto: ProdutoAgg;
  onBack: () => void;
  canWrite: boolean;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [showHistorico, setShowHistorico] = useState(false);
  const [vincOpen, setVincOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["alocacoes-produto", produto.produto_id, showHistorico],
    queryFn: async () => {
      let q = supabase
        .from("alocacoes")
        .select(
          "id, data_inicio, data_fim, observacao, licenca_id, ativos(id, hostname), usuarios(id, nome), licencas!inner(id, produto_id, chave_ativacao, contrato_id)",
        )
        .eq("licencas.produto_id", produto.produto_id)
        .order("data_inicio", { ascending: false });
      if (!showHistorico) q = q.is("data_fim", null);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AlocRow[];
    },
  });

  const rows = data ?? [];
  const allSelected = rows.length > 0 && rows.every((r) => sel.has(r.id));

  function toggle(id: string) {
    const n = new Set(sel);
    n.has(id) ? n.delete(id) : n.add(id);
    setSel(n);
  }
  function toggleAll() {
    setSel(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  async function desvincular(row: AlocRow) {
    const ok = await confirm({
      title: "Desvincular licença?",
      description: "A alocação é encerrada (data_fim = agora), preservando o histórico completo.",
      tone: "warn",
      impact: [
        { label: "Produto", value: produto.nome_oficial },
        { label: "Ativo", value: row.ativos?.hostname ?? "—" },
        { label: "Colaborador", value: row.usuarios?.nome ?? "—" },
      ],
      confirmLabel: "Desvincular",
    });
    if (!ok) return;
    const r = await encerrarAlocacao(row.id, "Desvinculado via ficha da licença");
    if (!r.ok) return toast.error(r.error || "Erro");
    toast.success("Desvinculado");
    qc.invalidateQueries({ queryKey: ["alocacoes-produto"] });
    qc.invalidateQueries({ queryKey: ["licencas-produtos-agg"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  async function bulkDesvincular() {
    const ativas = rows.filter((r) => sel.has(r.id) && !r.data_fim);
    if (ativas.length === 0) return toast.info("Nenhuma alocação ativa selecionada");
    const ok = await confirm({
      title: `Desvincular ${ativas.length} atribuição(ões)?`,
      description: "Todas serão encerradas com a mesma data. Histórico preservado.",
      tone: "warn",
      impact: [
        { label: "Produto", value: produto.nome_oficial },
        { label: "Seats liberados", value: `+${ativas.length}`, tone: "warn" },
      ],
      confirmLabel: "Desvincular selecionadas",
    });
    if (!ok) return;
    const r = await encerrarAlocacoes(ativas.map((a) => a.id), "Desvinculado em massa via ficha da licença");
    if (!r.ok) return toast.error(r.error || "Erro");
    toast.success(`${r.total} desvinculada(s)`);
    setSel(new Set());
    qc.invalidateQueries({ queryKey: ["alocacoes-produto"] });
    qc.invalidateQueries({ queryKey: ["licencas-produtos-agg"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{produto.nome_oficial}</div>
          <div className="text-xs text-muted-foreground truncate">
            {produto.fabricante ?? "—"} · {produto.categoria}{produto.subtipo ? ` · ${produto.subtipo}` : ""}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-4">
            <CardTitle className="text-base">Atribuições</CardTitle>
            <div className="text-xs text-muted-foreground tabular-nums">
              {produto.licencas_alocadas} de {produto.licencas_compradas} · saldo{" "}
              <span className={produto.saldo < 0 ? "text-destructive font-medium" : "font-medium"}>{produto.saldo}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowHistorico((v) => !v)}>
              {showHistorico ? "Só ativas" : "Ver histórico"}
            </Button>
            {canWrite && sel.size > 0 && (
              <Button size="sm" variant="outline" className="text-destructive" onClick={bulkDesvincular}>
                <Unlink className="h-4 w-4" /> Desvincular ({sel.size})
              </Button>
            )}
            {canWrite && (
              <Button size="sm" onClick={() => setVincOpen(true)}>
                <Link2 className="h-4 w-4" /> Vincular
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Link2 className="h-6 w-6" />}
                title={showHistorico ? "Sem histórico" : "Nenhuma atribuição ativa"}
                description="Use o botão Vincular para atribuir uma licença a um ativo ou colaborador."
              />
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="w-8 p-2">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                    </th>
                    <th className="text-left p-2 font-medium">Ativo</th>
                    <th className="text-left p-2 font-medium">Colaborador</th>
                    <th className="text-left p-2 font-medium">Início</th>
                    <th className="text-left p-2 font-medium">Fim</th>
                    <th className="text-left p-2 font-medium">Status</th>
                    <th className="w-16 p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t hover:bg-muted/30">
                      <td className="p-2">
                        <Checkbox checked={sel.has(r.id)} onCheckedChange={() => toggle(r.id)} />
                      </td>
                      <td className="p-2 font-mono text-xs">{r.ativos?.hostname ?? "—"}</td>
                      <td className="p-2">{r.usuarios?.nome ?? "—"}</td>
                      <td className="p-2 tabular-nums">{r.data_inicio ? new Date(r.data_inicio).toLocaleDateString("pt-BR") : "—"}</td>
                      <td className="p-2 tabular-nums">{r.data_fim ? new Date(r.data_fim).toLocaleDateString("pt-BR") : "—"}</td>
                      <td className="p-2">
                        <Badge variant={!r.data_fim ? "default" : "secondary"}>{!r.data_fim ? "ativa" : "encerrada"}</Badge>
                      </td>
                      <td className="p-2 text-right">
                        {canWrite && !r.data_fim && (
                          <Button size="icon" variant="ghost" onClick={() => desvincular(r)} title="Desvincular">
                            <Unlink className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <LicencasDoProduto produto={produto} />

      <VincularDialog
        open={vincOpen}
        onOpenChange={setVincOpen}
        produto={produto}
        onDone={() => {
          qc.invalidateQueries({ queryKey: ["alocacoes-produto"] });
          qc.invalidateQueries({ queryKey: ["licencas-produtos-agg"] });
          qc.invalidateQueries({ queryKey: ["dashboard"] });
        }}
      />
    </div>
  );
}

/* ------------------- Blocos de licenças do produto (SKUs) ------------------- */

function LicencasDoProduto({ produto }: { produto: ProdutoAgg }) {
  const { canWrite } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["licencas-blocos", produto.produto_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("licencas")
        .select("*, contratos(fornecedor, numero_contrato)")
        .eq("produto_id", produto.produto_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  async function remove(id: string, qtd: number) {
    const ok = await confirm({
      title: "Excluir bloco de licenças?",
      description: "Alocações vinculadas ficarão órfãs. Considere apenas encerrar as alocações.",
      tone: "danger",
      impact: [{ label: "Seats do bloco", value: qtd, tone: "danger" }],
      confirmLabel: "Excluir",
    });
    if (!ok) return;
    const { error } = await supabase.from("licencas").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Bloco excluído");
    qc.invalidateQueries({ queryKey: ["licencas-blocos"] });
    qc.invalidateQueries({ queryKey: ["licencas-produtos-agg"] });
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Blocos de licenças (SKUs)</CardTitle>
          {canWrite && (
            <Button size="sm" variant="outline" onClick={() => { setEditId(null); setOpen(true); }}>
              <Plus className="h-4 w-4" /> Novo bloco
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {(data ?? []).length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Nenhum bloco cadastrado.</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left p-2 font-medium">Contrato</th>
                    <th className="text-right p-2 font-medium">Qtd</th>
                    <th className="text-right p-2 font-medium">Custo unit.</th>
                    <th className="text-left p-2 font-medium">Expiração</th>
                    <th className="text-left p-2 font-medium">Ativação</th>
                    <th className="text-left p-2 font-medium">Certificado</th>
                    <th className="w-24 p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {(data ?? []).map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="p-2">{l.contratos ? `${l.contratos.fornecedor}${l.contratos.numero_contrato ? " · " + l.contratos.numero_contrato : ""}` : "—"}</td>
                      <td className="p-2 text-right tabular-nums">{l.quantidade}</td>
                      <td className="p-2 text-right tabular-nums">{l.custo_unitario != null ? Number(l.custo_unitario).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}</td>
                      <td className="p-2 tabular-nums">{l.data_expiracao ?? "—"}</td>
                      <td className="p-2 text-xs">{l.tipo_ativacao ?? "—"}</td>
                      <td className="p-2 font-mono text-xs">{l.numero_certificado ?? "—"}</td>
                      <td className="p-2 text-right">
                        {canWrite && (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => { setEditId(l.id); setOpen(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => remove(l.id, l.quantidade)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <LicencaDialog
        open={open}
        onOpenChange={setOpen}
        licencaId={editId}
        defaultProdutoId={produto.produto_id}
        defaultCategoria={produto.categoria}
      />
    </>
  );
}

/* ------------------------- Diálogo de Vincular ------------------------- */

function VincularDialog({
  open, onOpenChange, produto, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  produto: ProdutoAgg;
  onDone: () => void;
}) {
  const confirm = useConfirm();
  const [licencaId, setLicencaId] = useState<string | null>(null);
  const [ativoId, setAtivoId] = useState<string | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: licencas } = useQuery({
    queryKey: ["licencas-do-produto", produto.produto_id],
    queryFn: async () => (await supabase.from("licencas").select("id, quantidade, chave_ativacao, contratos(fornecedor)").eq("produto_id", produto.produto_id)).data ?? [],
    enabled: open,
  });
  const { data: ativos } = useQuery({
    queryKey: ["ativos-search"],
    queryFn: async () => (await supabase.from("ativos").select("id, hostname").neq("status_ciclo_vida", "baixado").order("hostname")).data ?? [],
    enabled: open,
  });
  const { data: usuarios } = useQuery({
    queryKey: ["usuarios-ativos"],
    queryFn: async () => (await supabase.from("usuarios").select("id, nome").eq("status", "ativo").order("nome")).data ?? [],
    enabled: open,
  });

  // Se só há um bloco de licença, seleciona automaticamente
  const autoLic = licencas && licencas.length === 1 ? licencas[0].id : null;
  const effectiveLic = licencaId ?? autoLic;

  async function submit() {
    if (!effectiveLic) return toast.error("Selecione o bloco de licença");
    if (!ativoId && !usuarioId) return toast.error("Selecione ao menos um ativo ou colaborador");

    const saldo = produto.saldo;
    if (saldo <= 0) {
      const ok = await confirm({
        title: "Gerar déficit de licenciamento?",
        description: `Esta ação vai gerar déficit para "${produto.nome_oficial}". A vinculação será registrada com marcação no log de auditoria.`,
        tone: "danger",
        impact: [
          { label: "Saldo atual", value: saldo, tone: "danger" },
          { label: "Saldo após", value: saldo - 1, tone: "danger" },
        ],
        confirmLabel: "Vincular assim mesmo",
      });
      if (!ok) return;
    }

    setBusy(true);
    const r = await criarAlocacao({
      licenca_id: effectiveLic,
      ativo_id: ativoId,
      usuario_id: usuarioId,
      observacao: obs || null,
      saldoAntes: saldo,
    });
    setBusy(false);
    if (!r.ok) return toast.error(r.error || "Erro");
    toast.success(r.deficit ? "Vinculado (com déficit registrado)" : "Vinculado");
    onOpenChange(false);
    setLicencaId(null); setAtivoId(null); setUsuarioId(null); setObs("");
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Vincular licença — {produto.nome_oficial}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {(licencas?.length ?? 0) > 1 && (
            <div>
              <Label>Bloco de licença</Label>
              <Combobox
                placeholder="Selecione o bloco…"
                value={licencaId}
                onChange={setLicencaId}
                options={(licencas ?? []).map((l: any) => ({
                  value: l.id,
                  label: `${l.contratos?.fornecedor ?? "s/ contrato"} · ${l.quantidade} seats`,
                  hint: l.chave_ativacao ?? undefined,
                }))}
              />
            </div>
          )}
          <div>
            <Label>Ativo (hostname)</Label>
            <Combobox
              placeholder="Buscar por hostname…"
              searchPlaceholder="Digite parte do hostname…"
              value={ativoId}
              onChange={setAtivoId}
              options={(ativos ?? []).map((a) => ({ value: a.id, label: a.hostname }))}
            />
          </div>
          <div>
            <Label>Colaborador (opcional)</Label>
            <Combobox
              placeholder="Nenhum"
              searchPlaceholder="Buscar colaborador…"
              value={usuarioId}
              onChange={setUsuarioId}
              options={(usuarios ?? []).map((u) => ({ value: u.id, label: u.nome }))}
            />
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
          </div>
          <div className="rounded-md border bg-muted/40 p-2 text-xs flex justify-between">
            <span className="text-muted-foreground">Saldo atual</span>
            <span className={`font-medium tabular-nums ${produto.saldo <= 0 ? "text-destructive" : ""}`}>{produto.saldo}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Vinculando…" : "Vincular"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------- Diálogo de Nova/Editar Licença ------------------------- */

function LicencaDialog({
  open, onOpenChange, licencaId, defaultProdutoId, defaultCategoria,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  licencaId: string | null;
  defaultProdutoId?: string;
  defaultCategoria?: string | null;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({
    produto_id: defaultProdutoId ?? "",
    contrato_id: null,
    quantidade: 1,
    custo_unitario: "",
    data_expiracao: "",
    chave_ativacao: "",
    tipo_ativacao: "",
    numero_certificado: "",
    limite_workstations: "",
    limite_file_servers: "",
    dias_carencia: 0,
    politica_grupo: "",
  });

  const { data: produtos } = useQuery({
    queryKey: ["produtos-with-cat"],
    queryFn: async () => (await supabase.from("produtos_catalogo").select("id, nome_oficial, categoria, subtipo").order("nome_oficial")).data ?? [],
    enabled: open,
  });
  const { data: contratos } = useQuery({
    queryKey: ["contratos-lite"],
    queryFn: async () => (await supabase.from("contratos").select("id, fornecedor, numero_contrato").order("fornecedor")).data ?? [],
    enabled: open,
  });

  // Carrega quando edita
  useMemo(() => {
    if (!open) return;
    if (licencaId) {
      supabase.from("licencas").select("*").eq("id", licencaId).single().then(({ data }) => {
        if (data) setForm({
          produto_id: data.produto_id ?? "",
          contrato_id: data.contrato_id,
          quantidade: data.quantidade ?? 1,
          custo_unitario: data.custo_unitario?.toString() ?? "",
          data_expiracao: data.data_expiracao ?? "",
          chave_ativacao: data.chave_ativacao ?? "",
          tipo_ativacao: data.tipo_ativacao ?? "",
          numero_certificado: data.numero_certificado ?? "",
          limite_workstations: data.limite_workstations?.toString() ?? "",
          limite_file_servers: data.limite_file_servers?.toString() ?? "",
          dias_carencia: data.dias_carencia ?? 0,
          politica_grupo: data.politica_grupo ?? "",
        });
      });
    } else {
      setForm((f: any) => ({ ...f, produto_id: defaultProdutoId ?? "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, licencaId]);

  const prodSel = (produtos ?? []).find((p: any) => p.id === form.produto_id);
  const isEDR = (prodSel?.categoria ?? defaultCategoria) === "EDR";

  async function save() {
    if (!form.produto_id) return toast.error("Selecione o produto");
    const payload: any = {
      produto_id: form.produto_id,
      contrato_id: form.contrato_id,
      quantidade: Number(form.quantidade) || 1,
      chave_ativacao: form.chave_ativacao || null,
      data_expiracao: form.data_expiracao || null,
      custo_unitario: form.custo_unitario ? Number(form.custo_unitario) : null,
      tipo_ativacao: form.tipo_ativacao || null,
      numero_certificado: form.numero_certificado || null,
      limite_workstations: form.limite_workstations ? Number(form.limite_workstations) : null,
      limite_file_servers: form.limite_file_servers ? Number(form.limite_file_servers) : null,
      dias_carencia: Number(form.dias_carencia) || 0,
      politica_grupo: form.politica_grupo || null,
    };
    const { error } = licencaId
      ? await supabase.from("licencas").update(payload).eq("id", licencaId)
      : await supabase.from("licencas").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    onOpenChange(false);
    qc.invalidateQueries({ queryKey: ["licencas-blocos"] });
    qc.invalidateQueries({ queryKey: ["licencas-produtos-agg"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const [busy, setBusy] = useState(false);
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try { await save(); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{licencaId ? "Editar bloco de licenças" : "Nova licença"}</DialogTitle>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <Label>Produto *</Label>
            <Combobox
              placeholder="Selecione…"
              clearable={false}
              value={form.produto_id || null}
              onChange={(v) => setForm({ ...form, produto_id: v ?? "" })}
              options={(produtos ?? []).map((p: any) => ({ value: p.id, label: p.nome_oficial, hint: `${p.categoria}${p.subtipo ? " · " + p.subtipo : ""}` }))}
            />
          </div>
          <div>
            <Label>Contrato</Label>
            <Combobox
              placeholder="Nenhum"
              value={form.contrato_id}
              onChange={(v) => setForm({ ...form, contrato_id: v })}
              options={(contratos ?? []).map((c: any) => ({ value: c.id, label: c.fornecedor, hint: c.numero_contrato ?? undefined }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Quantidade</Label><Input type="number" min={1} value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: Number(e.target.value) })} /></div>
            <div><Label>Custo unitário (R$)</Label><Input type="number" step="0.01" min={0} value={form.custo_unitario} onChange={(e) => setForm({ ...form, custo_unitario: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Expiração</Label><Input type="date" value={form.data_expiracao} onChange={(e) => setForm({ ...form, data_expiracao: e.target.value })} /></div>
            <div><Label>Chave de ativação</Label><Input value={form.chave_ativacao} onChange={(e) => setForm({ ...form, chave_ativacao: e.target.value })} /></div>
          </div>

          {isEDR && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Settings2 className="h-3 w-3" /> Kaspersky / EDR
              </div>
              <div>
                <Label>Tipo de ativação</Label>
                <Select value={form.tipo_ativacao} onValueChange={(v) => setForm({ ...form, tipo_ativacao: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chave_ativacao">Chave de ativação</SelectItem>
                    <SelectItem value="arquivo_chave">Arquivo-chave</SelectItem>
                    <SelectItem value="assinatura">Assinatura</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Número do certificado</Label>
                <Input value={form.numero_certificado} onChange={(e) => setForm({ ...form, numero_certificado: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Limite de workstations</Label><Input type="number" min={0} value={form.limite_workstations} onChange={(e) => setForm({ ...form, limite_workstations: e.target.value })} /></div>
                <div><Label>Limite de file servers</Label><Input type="number" min={0} value={form.limite_file_servers} onChange={(e) => setForm({ ...form, limite_file_servers: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Dias de carência</Label><Input type="number" min={0} value={form.dias_carencia} onChange={(e) => setForm({ ...form, dias_carencia: e.target.value })} /></div>
                <div><Label>Grupo de política</Label><Input value={form.politica_grupo} onChange={(e) => setForm({ ...form, politica_grupo: e.target.value })} /></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

