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
  produtos_catalogo?: { nome_oficial: string } | null;
  contratos?: { fornecedor: string; numero_contrato: string | null } | null;
};

const initial = { produto_id: "", contrato_id: null as string | null, quantidade: 1, chave_ativacao: "", data_expiracao: "" };

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diff = (new Date(iso).getTime() - Date.now()) / 86400000;
  return Math.ceil(diff);
}

function Page() {
  const { canWrite } = useAuth();
  const qc = useQueryClient();
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
    };
    const { error } = editing
      ? await supabase.from("licencas").update(payload).eq("id", editing.id)
      : await supabase.from("licencas").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    qc.invalidateQueries({ queryKey: ["licencas"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }
  async function remove(id: string) {
    if (!confirm("Excluir licença?")) return;
    const { error } = await supabase.from("licencas").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["licencas"] });
  }
  async function bulkDelete(sel: Row[], clear: () => void) {
    if (!confirm(`Excluir ${sel.length} licença(s)?`)) return;
    const { error } = await supabase.from("licencas").delete().in("id", sel.map((r) => r.id));
    if (error) return toast.error(error.message);
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
              <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
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
          <Select value={form.produto_id} onValueChange={(v) => setForm({ ...form, produto_id: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
            <SelectContent>{(produtos ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.nome_oficial}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Contrato</Label>
          <Select value={form.contrato_id ?? "none"} onValueChange={(v) => setForm({ ...form, contrato_id: v === "none" ? null : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Nenhum —</SelectItem>
              {(contratos ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.fornecedor}{c.numero_contrato ? " · " + c.numero_contrato : ""}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Quantidade</Label><Input type="number" min={1} value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: Number(e.target.value) })} /></div>
          <div><Label>Expiração</Label><Input type="date" value={form.data_expiracao} onChange={(e) => setForm({ ...form, data_expiracao: e.target.value })} /></div>
        </div>
        <div><Label>Chave de ativação</Label><Input value={form.chave_ativacao} onChange={(e) => setForm({ ...form, chave_ativacao: e.target.value })} /></div>
      </CrudDialog>
    </>
  );
}
