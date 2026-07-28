import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { AdvancedTable, type Column } from "@/components/advanced-table";
import { CrudDialog } from "@/components/crud-dialog";
import { EmptyState } from "@/components/empty-state";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wrench, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useConfirm } from "@/components/confirm-dialog";

export const Route = createFileRoute("/_authenticated/pecas")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Peças — GestoraIT" },
      { name: "description", content: "Catálogo de peças e componentes para manutenção de ativos." },
    ],
  }),
});

type Row = {
  id: string;
  nome: string;
  categoria: string;
  fabricante: string | null;
  modelos_compativeis: string[];
  estoque_minimo: number;
  custo_unitario: number | null;
  fornecedor_padrao: string | null;
};
const initial = {
  nome: "", categoria: "", fabricante: "", modelos_compativeis: "",
  estoque_minimo: 0, custo_unitario: "", fornecedor_padrao: "",
};

function Page() {
  const { isGestorOrAdmin } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<typeof initial>(initial);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["pecas_catalogo"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("pecas_catalogo").select("*").order("nome");
      if (error) throw error;
      return data as Row[];
    },
  });

  function openNew() { setEditing(null); setForm(initial); setOpen(true); }
  function openEdit(r: Row) {
    setEditing(r);
    setForm({
      nome: r.nome, categoria: r.categoria,
      fabricante: r.fabricante ?? "",
      modelos_compativeis: (r.modelos_compativeis ?? []).join(", "),
      estoque_minimo: r.estoque_minimo,
      custo_unitario: r.custo_unitario?.toString() ?? "",
      fornecedor_padrao: r.fornecedor_padrao ?? "",
    });
    setOpen(true);
  }
  async function save() {
    const payload = {
      nome: form.nome.trim(),
      categoria: form.categoria.trim(),
      fabricante: form.fabricante.trim() || null,
      modelos_compativeis: form.modelos_compativeis.split(",").map((s) => s.trim()).filter(Boolean),
      estoque_minimo: Number(form.estoque_minimo) || 0,
      custo_unitario: form.custo_unitario ? Number(form.custo_unitario) : null,
      fornecedor_padrao: form.fornecedor_padrao.trim() || null,
    };
    const { error } = editing
      ? await (supabase as any).from("pecas_catalogo").update(payload).eq("id", editing.id)
      : await (supabase as any).from("pecas_catalogo").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    qc.invalidateQueries({ queryKey: ["pecas_catalogo"] });
  }
  async function remove(r: Row) {
    const ok = await confirm({
      title: "Excluir peça?",
      description: "As movimentações de estoque desta peça também serão removidas.",
      tone: "danger",
      impact: [{ label: "Peça", value: r.nome }],
      confirmLabel: "Excluir",
    });
    if (!ok) return;
    const { error } = await (supabase as any).from("pecas_catalogo").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["pecas_catalogo"] });
  }

  const columns: Column<Row>[] = [
    { id: "nome", header: "Peça", accessor: (r) => <span className="font-medium">{r.nome}</span>, sortValue: (r) => r.nome, searchValue: (r) => r.nome, exportValue: (r) => r.nome },
    { id: "categoria", header: "Categoria", accessor: (r) => <Badge variant="outline">{r.categoria}</Badge>, sortValue: (r) => r.categoria, searchValue: (r) => r.categoria, exportValue: (r) => r.categoria },
    { id: "fabricante", header: "Fabricante", accessor: (r) => r.fabricante ?? "—", searchValue: (r) => r.fabricante, exportValue: (r) => r.fabricante },
    { id: "modelos", header: "Modelos compatíveis", accessor: (r) => (r.modelos_compativeis?.length ? <span className="text-xs">{r.modelos_compativeis.join(", ")}</span> : "—"), searchValue: (r) => r.modelos_compativeis?.join(" "), exportValue: (r) => r.modelos_compativeis?.join("; ") },
    { id: "min", header: "Mín.", accessor: (r) => <span className="tabular-nums">{r.estoque_minimo}</span>, sortValue: (r) => r.estoque_minimo, exportValue: (r) => r.estoque_minimo },
    { id: "custo", header: "Custo (R$)", accessor: (r) => <span className="tabular-nums">{r.custo_unitario != null ? Number(r.custo_unitario).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "—"}</span>, sortValue: (r) => Number(r.custo_unitario ?? 0), exportValue: (r) => r.custo_unitario },
    { id: "fornecedor", header: "Fornecedor padrão", accessor: (r) => r.fornecedor_padrao ?? "—", searchValue: (r) => r.fornecedor_padrao, exportValue: (r) => r.fornecedor_padrao },
    {
      id: "acoes", header: "Ações", alwaysVisible: true,
      accessor: (r) => (
        <div className="flex gap-1">
          {isGestorOrAdmin && (
            <>
              <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Catálogo de peças"
        description="Peças e componentes usados nas manutenções, com estoque mínimo e fornecedor padrão."
        actions={isGestorOrAdmin ? <Button size="sm" onClick={openNew}>Nova peça</Button> : undefined}
      />
      <AdvancedTable<Row>
        storageKey="pecas_catalogo"
        rows={rows}
        isLoading={isLoading}
        columns={columns}
        getRowId={(r) => r.id}
        exportFilename="pecas"
        emptyState={
          <EmptyState
            icon={<Wrench className="h-6 w-6" />}
            title="Nenhuma peça cadastrada"
            description="Cadastre peças e defina o estoque mínimo para automatizar a reposição."
            action={isGestorOrAdmin ? <Button size="sm" onClick={openNew}>Nova peça</Button> : undefined}
          />
        }
      />
      <CrudDialog title={editing ? "Editar peça" : "Nova peça"} open={open} onOpenChange={setOpen} onSubmit={save} trigger={null}>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Nome *</Label><Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
          <div><Label>Categoria *</Label><Input required placeholder="ex: HD, Memória, Fonte" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Fabricante</Label><Input value={form.fabricante} onChange={(e) => setForm({ ...form, fabricante: e.target.value })} /></div>
          <div><Label>Fornecedor padrão</Label><Input value={form.fornecedor_padrao} onChange={(e) => setForm({ ...form, fornecedor_padrao: e.target.value })} /></div>
        </div>
        <div>
          <Label>Modelos compatíveis</Label>
          <Textarea rows={2} placeholder="Um modelo por vírgula, ex: Latitude 5420, Latitude 5430" value={form.modelos_compativeis} onChange={(e) => setForm({ ...form, modelos_compativeis: e.target.value })} />
          <p className="text-[11px] text-muted-foreground mt-1">Usado para sugerir peças ao registrar uma OS conforme o modelo do ativo.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Estoque mínimo</Label><Input type="number" min={0} value={form.estoque_minimo} onChange={(e) => setForm({ ...form, estoque_minimo: Number(e.target.value) })} /></div>
          <div><Label>Custo unitário (R$)</Label><Input type="number" step="0.01" value={form.custo_unitario} onChange={(e) => setForm({ ...form, custo_unitario: e.target.value })} /></div>
        </div>
      </CrudDialog>
    </>
  );
}
