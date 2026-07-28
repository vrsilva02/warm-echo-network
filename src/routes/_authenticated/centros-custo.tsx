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
import { Button } from "@/components/ui/button";
import { Coins, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useConfirm } from "@/components/confirm-dialog";

export const Route = createFileRoute("/_authenticated/centros-custo")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Centros de Custo — GestoraIT" },
      { name: "description", content: "Cadastro de centros de custo para rateio financeiro de TI." },
    ],
  }),
});

type Row = { id: string; nome: string; codigo: string | null };
const initial = { nome: "", codigo: "" };

function Page() {
  const { canWrite } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState(initial);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["centros_custo"],
    queryFn: async () => {
      const { data, error } = await supabase.from("centros_custo").select("id,nome,codigo").order("nome");
      if (error) throw error;
      return data as Row[];
    },
  });

  function openNew() { setEditing(null); setForm(initial); setOpen(true); }
  function openEdit(r: Row) { setEditing(r); setForm({ nome: r.nome, codigo: r.codigo ?? "" }); setOpen(true); }
  async function save() {
    const payload = { nome: form.nome.trim(), codigo: form.codigo.trim() || null };
    if (!payload.nome) return toast.error("Informe o nome");
    const { error } = editing
      ? await supabase.from("centros_custo").update(payload).eq("id", editing.id)
      : await supabase.from("centros_custo").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    qc.invalidateQueries({ queryKey: ["centros_custo"] });
    qc.invalidateQueries({ queryKey: ["centros_custo-lite"] });
  }
  async function remove(r: Row) {
    const ok = await confirm({
      title: "Excluir centro de custo?",
      description: "Ativos e contratos vinculados ficarão sem centro associado.",
      tone: "danger",
      impact: [{ label: "Centro", value: r.nome }],
      confirmLabel: "Excluir",
    });
    if (!ok) return;
    const { error } = await supabase.from("centros_custo").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["centros_custo"] });
  }

  const columns: Column<Row>[] = [
    { id: "nome", header: "Nome", accessor: (r) => <span className="font-medium">{r.nome}</span>, sortValue: (r) => r.nome, searchValue: (r) => r.nome, exportValue: (r) => r.nome },
    { id: "codigo", header: "Código", accessor: (r) => <span className="font-mono text-xs">{r.codigo ?? "—"}</span>, searchValue: (r) => r.codigo, exportValue: (r) => r.codigo },
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

  return (
    <>
      <PageHeader
        title="Centros de Custo"
        description="Segmentação financeira para rateio de ativos e contratos por área."
        actions={canWrite ? <Button size="sm" onClick={openNew}>Novo centro</Button> : undefined}
      />
      <AdvancedTable<Row>
        storageKey="centros_custo"
        rows={rows}
        isLoading={isLoading}
        columns={columns}
        getRowId={(r) => r.id}
        exportFilename="centros_custo"
        emptyState={
          <EmptyState
            icon={<Coins className="h-6 w-6" />}
            title="Nenhum centro cadastrado"
            description="Cadastre centros de custo para atribuir a ativos e contratos."
            action={canWrite ? <Button size="sm" onClick={openNew}>Novo centro</Button> : undefined}
          />
        }
      />
      <CrudDialog title={editing ? "Editar centro" : "Novo centro"} open={open} onOpenChange={setOpen} onSubmit={save} trigger={null}>
        <div><Label>Nome *</Label><Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
        <div><Label>Código</Label><Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="Ex.: TI-01" /></div>
      </CrudDialog>
    </>
  );
}
