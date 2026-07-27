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
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Building2, Pencil, Trash2 } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useConfirm } from "@/components/confirm-dialog";

export const Route = createFileRoute("/_authenticated/unidades")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Unidades — GestoraIT" },
      { name: "description", content: "Cadastro de unidades e filiais." },
    ],
  }),
});

type Row = { id: string; nome: string; codigo: string | null; uf: string | null; ativo: boolean };
const initial = { nome: "", codigo: "", uf: "", ativo: true };

function Page() {
  const { canWrite } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState(initial);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["unidades"],
    queryFn: async () => {
      const { data, error } = await supabase.from("unidades").select("*").order("nome");
      if (error) throw error;
      return data as Row[];
    },
  });

  function openNew() { setEditing(null); setForm(initial); setOpen(true); }
  function openEdit(r: Row) {
    setEditing(r);
    setForm({ nome: r.nome, codigo: r.codigo ?? "", uf: r.uf ?? "", ativo: r.ativo });
    setOpen(true);
  }
  async function save() {
    const payload = {
      nome: form.nome.trim(),
      codigo: form.codigo.trim() || null,
      uf: form.uf.trim().toUpperCase().slice(0, 2) || null,
      ativo: form.ativo,
    };
    const { error } = editing
      ? await supabase.from("unidades").update(payload).eq("id", editing.id)
      : await supabase.from("unidades").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    qc.invalidateQueries({ queryKey: ["unidades"] });
  }
  async function remove(r: Row) {
    const ok = await confirm({
      title: "Excluir unidade?",
      description: "Ativos e contratos vinculados ficarão sem unidade associada.",
      tone: "danger",
      impact: [{ label: "Unidade", value: r.nome }],
      confirmLabel: "Excluir",
    });
    if (!ok) return;
    const { error } = await supabase.from("unidades").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["unidades"] });
  }

  const columns: Column<Row>[] = [
    { id: "nome", header: "Nome", accessor: (r) => <span className="font-medium">{r.nome}</span>, sortValue: (r) => r.nome, searchValue: (r) => r.nome, exportValue: (r) => r.nome },
    { id: "codigo", header: "Código", accessor: (r) => r.codigo ?? "—", searchValue: (r) => r.codigo, exportValue: (r) => r.codigo },
    { id: "uf", header: "UF", accessor: (r) => r.uf ?? "—", exportValue: (r) => r.uf },
    { id: "ativo", header: "Status", accessor: (r) => <StatusPill tone={r.ativo ? "ok" : "neutral"}>{r.ativo ? "Ativa" : "Inativa"}</StatusPill>, exportValue: (r) => (r.ativo ? "ativa" : "inativa") },
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
        title="Unidades / Filiais"
        description="Cadastre unidades para segmentar ativos e contratos por localidade."
        actions={canWrite ? <Button size="sm" onClick={openNew}>Nova unidade</Button> : undefined}
      />
      <AdvancedTable<Row>
        storageKey="unidades"
        rows={rows}
        isLoading={isLoading}
        columns={columns}
        getRowId={(r) => r.id}
        exportFilename="unidades"
        emptyState={
          <EmptyState
            icon={<Building2 className="h-6 w-6" />}
            title="Sem unidades cadastradas"
            description="Cadastre a primeira unidade para segmentar seus ativos."
            action={canWrite ? <Button size="sm" onClick={openNew}>Nova unidade</Button> : undefined}
          />
        }
      />
      <CrudDialog title={editing ? "Editar unidade" : "Nova unidade"} open={open} onOpenChange={setOpen} onSubmit={save} trigger={null}>
        <div><Label>Nome *</Label><Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Código</Label><Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} /></div>
          <div><Label>UF</Label><Input maxLength={2} value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })} /></div>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} id="uni-ativo" />
          <Label htmlFor="uni-ativo">Unidade ativa</Label>
        </div>
      </CrudDialog>
    </>
  );
}
