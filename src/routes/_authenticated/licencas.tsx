import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { AdvancedTable, type Column, type SavedView } from "@/components/advanced-table";
import { CrudDialog } from "@/components/crud-dialog";
import { EmptyState } from "@/components/empty-state";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { useConfirm } from "@/components/confirm-dialog";
import { Combobox } from "@/components/combobox";

export const Route = createFileRoute("/_authenticated/licencas")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Licenças — ITAM/SAM" },
      { name: "description", content: "Blocos de licenças por produto e contrato." },
    ],
  }),
});

type Row = {
  id: string;
  produto_id: string | null;
  contrato_id: string | null;
  quantidade: number;
  chave_ativacao: string | null;
  data_expiracao: string | null;
  custo_unitario: number | null;
  produtos_catalogo?: { nome_oficial: string } | null;
  contratos?: { fornecedor: string; numero_contrato: string | null } | null;
};

const initial = { produto_id: "", contrato_id: null as string | null, quantidade: 1, chave_ativacao: "", data_expiracao: "", custo_unitario: "" };

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diff = (new Date(iso).getTime() - Date.now()) / 86400000;
  return Math.ceil(diff);
}

function Page() {
  const { canWrite } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState(initial);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["licencas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("licencas")
        .select("*, produtos_catalogo(nome_oficial), contratos(fornecedor, numero_contrato)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Row[];
    },
  });
  const { data: produtos } = useQuery({
    queryKey: ["produtos-lite"],
    queryFn: async () => (await supabase.from("produtos_catalogo").select("id, nome_oficial").order("nome_oficial")).data ?? [],
  });
  const { data: contratos } = useQuery({
    queryKey: ["contratos-lite"],
    queryFn: async () => (await supabase.from("contratos").select("id, fornecedor, numero_contrato").order("fornecedor")).data ?? [],
  });

  function openNew() { setEditing(null); setForm(initial); setOpen(true); }
  function openEdit(r: Row) {
    setEditing(r);
    setForm({
      produto_id: r.produto_id ?? "",
      contrato_id: r.contrato_id,
      quantidade: r.quantidade,
      chave_ativacao: r.chave_ativacao ?? "",
      data_expiracao: r.data_expiracao ?? "",
      custo_unitario: r.custo_unitario?.toString() ?? "",
    });
    setOpen(true);
  }
  async function save() {
    if (!form.produto_id) return toast.error("Selecione o produto");
    const payload = {
      produto_id: form.produto_id,
      contrato_id: form.contrato_id,
      quantidade: Number(form.quantidade) || 1,
      chave_ativacao: form.chave_ativacao || null,
      data_expiracao: form.data_expiracao || null,
      custo_unitario: form.custo_unitario ? Number(form.custo_unitario) : null,
    };
    const { error } = editing
      ? await supabase.from("licencas").update(payload).eq("id", editing.id)
      : await supabase.from("licencas").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    qc.invalidateQueries({ queryKey: ["licencas"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }
  async function remove(row: Row) {
    const { count } = await supabase
      .from("alocacoes").select("id", { count: "exact", head: true })
      .eq("licenca_id", row.id).is("data_fim", null);
    const ok = await confirm({
      title: "Excluir bloco de licenças?",
      description: "As alocações vinculadas ficarão órfãs. Considere manter e apenas encerrar alocações.",
      tone: "danger",
      impact: [
        { label: "Produto", value: row.produtos_catalogo?.nome_oficial ?? "—" },
        { label: "Quantidade do bloco", value: row.quantidade },
        { label: "Alocações ativas", value: count ?? 0, tone: (count ?? 0) > 0 ? "danger" : "default" },
      ],
      confirmLabel: "Excluir",
    });
    if (!ok) return;
    const { error } = await supabase.from("licencas").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["licencas"] });
  }
  async function bulkDelete(sel: Row[], clear: () => void) {
    const totalSeats = sel.reduce((a, r) => a + (r.quantidade ?? 0), 0);
    const ok = await confirm({
      title: `Excluir ${sel.length} licença(s)?`,
      description: "Ação irreversível. Alocações vinculadas ficarão órfãs.",
      tone: "danger",
      impact: [
        { label: "Blocos", value: sel.length, tone: "danger" },
        { label: "Seats totais afetados", value: totalSeats, tone: "danger" },
      ],
      confirmLabel: "Excluir todas",
    });
    if (!ok) return;
    const ids = sel.map((r) => r.id);
    const { error } = await supabase.from("licencas").delete().in("id", ids);
    if (error) return toast.error(error.message);
    void logAction("BULK_DELETE", "licencas", { ids, total: ids.length });
    toast.success("Excluídas");
    clear();
    qc.invalidateQueries({ queryKey: ["licencas"] });
  }

  const columns: Column<Row>[] = [
    {
      id: "produto", header: "Produto",
      accessor: (r) => <span className="font-medium">{r.produtos_catalogo?.nome_oficial ?? "—"}</span>,
      sortValue: (r) => r.produtos_catalogo?.nome_oficial ?? "",
      searchValue: (r) => r.produtos_catalogo?.nome_oficial,
      exportValue: (r) => r.produtos_catalogo?.nome_oficial,
    },
    {
      id: "contrato", header: "Contrato",
      accessor: (r) => r.contratos ? `${r.contratos.fornecedor}${r.contratos.numero_contrato ? " · " + r.contratos.numero_contrato : ""}` : "—",
      sortValue: (r) => r.contratos?.fornecedor ?? "",
      searchValue: (r) => r.contratos ? `${r.contratos.fornecedor} ${r.contratos.numero_contrato ?? ""}` : "",
      exportValue: (r) => r.contratos ? `${r.contratos.fornecedor} ${r.contratos.numero_contrato ?? ""}` : "",
    },
    {
      id: "qtd", header: "Qtd", numeric: true,
      accessor: (r) => r.quantidade,
      sortValue: (r) => r.quantidade, exportValue: (r) => r.quantidade,
    },
    {
      id: "chave", header: "Chave", defaultHidden: true,
      accessor: (r) => r.chave_ativacao ? <span className="font-mono text-xs">{r.chave_ativacao.slice(0, 12)}…</span> : "—",
      searchValue: (r) => r.chave_ativacao, exportValue: (r) => r.chave_ativacao,
    },
    {
      id: "expiracao", header: "Expiração",
      accessor: (r) => {
        if (!r.data_expiracao) return "—";
        const d = daysUntil(r.data_expiracao)!;
        const tone = d < 0 ? "bg-destructive/15 text-destructive border-destructive/30"
          : d <= 30 ? "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30"
          : "";
        return <Badge variant="outline" className={tone}>{r.data_expiracao}</Badge>;
      },
      sortValue: (r) => r.data_expiracao ?? "",
      exportValue: (r) => r.data_expiracao,
    },
    {
      id: "acoes", header: "Ações", alwaysVisible: true,
      accessor: (r) => (
        <div className="flex gap-1">
          {canWrite && (
            <>
              <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>
            </>
          )}
        </div>
      ),
    },
  ];

  const views: SavedView<Row>[] = [
    { id: "vencidas", label: "Vencidas", filter: (rs) => rs.filter((r) => { const d = daysUntil(r.data_expiracao); return d != null && d < 0; }) },
    { id: "vencendo30", label: "Vencem em 30d", filter: (rs) => rs.filter((r) => { const d = daysUntil(r.data_expiracao); return d != null && d >= 0 && d <= 30; }) },
    { id: "sem_contrato", label: "Sem contrato", filter: (rs) => rs.filter((r) => !r.contrato_id) },
    { id: "perpetuas", label: "Perpétuas", filter: (rs) => rs.filter((r) => !r.data_expiracao) },
  ];

  return (
    <>
      <PageHeader
        title="Licenças"
        description="Cada linha representa um bloco de licenças de um produto/contrato."
        actions={canWrite ? <Button size="sm" onClick={openNew}>Nova licença</Button> : undefined}
      />
      <AdvancedTable<Row>
        storageKey="licencas"
        rows={rows}
        isLoading={isLoading}
        columns={columns}
        getRowId={(r) => r.id}
        savedViews={views}
        exportFilename="licencas"
        emptyState={
          <EmptyState
            icon={<KeyRound className="h-6 w-6" />}
            title="Sem licenças registradas"
            description="Cadastre blocos de licenças para acompanhar consumo e vencimentos."
            action={canWrite ? <Button size="sm" onClick={openNew}>Nova licença</Button> : undefined}
          />
        }
        bulkActions={canWrite ? (sel, clear) => (
          <Button size="sm" variant="outline" className="text-destructive" onClick={() => bulkDelete(sel, clear)}>Excluir selecionadas</Button>
        ) : undefined}
      />
      <CrudDialog title={editing ? "Editar licença" : "Nova licença"} open={open} onOpenChange={setOpen} onSubmit={save} trigger={null}>
        <div>
          <Label>Produto *</Label>
          <Combobox
            placeholder="Selecione…"
            searchPlaceholder="Buscar produto…"
            clearable={false}
            value={form.produto_id || null}
            onChange={(v) => setForm({ ...form, produto_id: v ?? "" })}
            options={(produtos ?? []).map((p) => ({ value: p.id, label: p.nome_oficial }))}
          />
        </div>
        <div>
          <Label>Contrato</Label>
          <Combobox
            placeholder="Nenhum"
            searchPlaceholder="Buscar fornecedor/contrato…"
            value={form.contrato_id}
            onChange={(v) => setForm({ ...form, contrato_id: v })}
            options={(contratos ?? []).map((c) => ({
              value: c.id,
              label: c.fornecedor,
              hint: c.numero_contrato ?? undefined,
            }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Quantidade</Label><Input type="number" min={1} value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: Number(e.target.value) })} /></div>
          <div><Label>Expiração</Label><Input type="date" value={form.data_expiracao} onChange={(e) => setForm({ ...form, data_expiracao: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Custo unitário (R$)</Label><Input type="number" step="0.01" min={0} value={form.custo_unitario} onChange={(e) => setForm({ ...form, custo_unitario: e.target.value })} /></div>
          <div><Label>Chave de ativação</Label><Input value={form.chave_ativacao} onChange={(e) => setForm({ ...form, chave_ativacao: e.target.value })} /></div>
        </div>
      </CrudDialog>
    </>
  );
}
