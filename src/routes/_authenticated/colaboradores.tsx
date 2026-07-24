import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { DataTable, ListToolbar, useFilteredList } from "@/components/data-table";
import { CrudDialog } from "@/components/crud-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/colaboradores")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Colaboradores — ITAM/SAM" },
      { name: "description", content: "Cadastro de colaboradores para atribuição de ativos e licenças." },
    ],
  }),
});

type Row = {
  id: string;
  nome: string;
  email: string | null;
  matricula: string | null;
  setor: string | null;
  status: string;
  data_desligamento: string | null;
};

const initial = { nome: "", email: "", matricula: "", setor: "", status: "ativo", data_desligamento: "" };

function Page() {
  const { canWrite } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => {
      const { data, error } = await supabase.from("usuarios").select("*").order("nome");
      if (error) throw error;
      return data as Row[];
    },
  });

  const filtered = useFilteredList(rows, q, ["nome", "email", "matricula", "setor"]);

  function openNew() { setEditing(null); setForm(initial); setOpen(true); }
  function openEdit(r: Row) {
    setEditing(r);
    setForm({
      nome: r.nome,
      email: r.email ?? "",
      matricula: r.matricula ?? "",
      setor: r.setor ?? "",
      status: r.status,
      data_desligamento: r.data_desligamento ?? "",
    });
    setOpen(true);
  }
  async function save() {
    const payload = {
      nome: form.nome.trim(),
      email: form.email || null,
      matricula: form.matricula || null,
      setor: form.setor || null,
      status: form.status,
      data_desligamento: form.status === "desligado" ? (form.data_desligamento || new Date().toISOString().slice(0, 10)) : null,
    };
    const { error } = editing
      ? await supabase.from("usuarios").update(payload).eq("id", editing.id)
      : await supabase.from("usuarios").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    qc.invalidateQueries({ queryKey: ["usuarios"] });
    qc.invalidateQueries({ queryKey: ["usuarios-lite"] });
  }
  async function remove(id: string) {
    if (!confirm("Excluir colaborador?")) return;
    const { error } = await supabase.from("usuarios").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["usuarios"] });
  }

  return (
    <>
      <PageHeader
        title="Colaboradores"
        description="Ao marcar como desligado, as licenças alocadas são liberadas automaticamente."
        actions={canWrite ? <Button size="sm" onClick={openNew}>Novo colaborador</Button> : undefined}
      />
      <ListToolbar query={q} onQueryChange={setQ} />
      <DataTable
        columns={["Nome", "Email", "Matrícula", "Setor", "Status", "Ações"]}
        empty={isLoading ? "Carregando…" : "Nenhum colaborador."}
        rows={filtered.map((r) => [
          <span key="n" className="font-medium">{r.nome}</span>,
          r.email ?? "—",
          r.matricula ?? "—",
          r.setor ?? "—",
          <Badge key="s" variant={r.status === "ativo" ? "default" : "secondary"}>{r.status}</Badge>,
          <div key="a" className="flex gap-1">
            {canWrite && <>
              <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
            </>}
          </div>,
        ])}
      />
      <CrudDialog title={editing ? "Editar colaborador" : "Novo colaborador"} open={open} onOpenChange={setOpen} onSubmit={save} trigger={null}>
        <div><Label>Nome</Label><Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Matrícula</Label><Input value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Setor</Label><Input value={form.setor} onChange={(e) => setForm({ ...form, setor: e.target.value })} /></div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="desligado">Desligado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {form.status === "desligado" && (
          <div>
            <Label>Data de desligamento</Label>
            <Input type="date" value={form.data_desligamento} onChange={(e) => setForm({ ...form, data_desligamento: e.target.value })} />
          </div>
        )}
      </CrudDialog>
    </>
  );
}
