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

export const Route = createFileRoute("/_authenticated/ativos")({
  component: AtivosPage,
  head: () => ({
    meta: [
      { title: "Ativos — ITAM/SAM" },
      { name: "description", content: "Cadastro e ciclo de vida de ativos corporativos." },
    ],
  }),
});

type Ativo = {
  id: string;
  hostname: string;
  tipo: string;
  numero_serie: string | null;
  numero_patrimonio: string | null;
  setor: string | null;
  status_ciclo_vida: string;
  usuario_responsavel_id: string | null;
  usuarios?: { nome: string } | null;
};

const STATUS = ["em_estoque", "em_uso", "em_manutencao", "baixado"];
const TIPOS = ["Notebook", "Desktop", "Servidor", "VDI", "Outro"];

const initial = {
  hostname: "",
  tipo: "Notebook",
  numero_serie: "",
  numero_patrimonio: "",
  setor: "",
  status_ciclo_vida: "em_estoque",
  usuario_responsavel_id: null as string | null,
};

function statusBadge(s: string) {
  const map: Record<string, string> = {
    em_uso: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
    em_estoque: "bg-primary/10 text-primary border-primary/30",
    em_manutencao: "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30",
    baixado: "bg-muted text-muted-foreground",
  };
  return <Badge variant="outline" className={map[s] ?? ""}>{s.replace("_", " ")}</Badge>;
}

function AtivosPage() {
  const { canWrite } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Ativo | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ativos")
        .select("*, usuarios(nome)")
        .order("hostname");
      if (error) throw error;
      return data as unknown as Ativo[];
    },
  });

  const { data: users } = useQuery({
    queryKey: ["usuarios-lite"],
    queryFn: async () => (await supabase.from("usuarios").select("id,nome").eq("status", "ativo").order("nome")).data ?? [],
  });

  const filtered = useFilteredList(rows, q, ["hostname", "tipo", "setor", "numero_serie", "numero_patrimonio", "status_ciclo_vida"]);

  function openNew() {
    setEditing(null);
    setForm(initial);
    setOpen(true);
  }
  function openEdit(r: Ativo) {
    setEditing(r);
    setForm({
      hostname: r.hostname,
      tipo: r.tipo,
      numero_serie: r.numero_serie ?? "",
      numero_patrimonio: r.numero_patrimonio ?? "",
      setor: r.setor ?? "",
      status_ciclo_vida: r.status_ciclo_vida,
      usuario_responsavel_id: r.usuario_responsavel_id,
    });
    setOpen(true);
  }

  async function save() {
    const payload = {
      hostname: form.hostname.trim(),
      tipo: form.tipo,
      numero_serie: form.numero_serie || null,
      numero_patrimonio: form.numero_patrimonio.trim() || null,
      setor: form.setor || null,
      status_ciclo_vida: form.status_ciclo_vida,
      usuario_responsavel_id: form.usuario_responsavel_id,
    };
    const { error } = editing
      ? await supabase.from("ativos").update(payload).eq("id", editing.id)
      : await supabase.from("ativos").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Ativo atualizado" : "Ativo criado");
    qc.invalidateQueries({ queryKey: ["ativos"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  async function remove(id: string) {
    if (!confirm("Excluir este ativo?")) return;
    const { error } = await supabase.from("ativos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Ativo excluído");
    qc.invalidateQueries({ queryKey: ["ativos"] });
  }

  return (
    <>
      <PageHeader
        title="Ativos"
        description="Notebooks, desktops, servidores e VDIs — com ciclo de vida controlado."
        actions={canWrite ? <Button size="sm" onClick={openNew}>Novo ativo</Button> : undefined}
      />
      <ListToolbar query={q} onQueryChange={setQ} />
      <DataTable
        columns={["Hostname", "Patrimônio", "Tipo", "Setor", "Responsável", "Status", "Ações"]}
        empty={isLoading ? "Carregando…" : "Nenhum ativo."}
        rows={filtered.map((r) => [
          <span key="h" className="font-medium">{r.hostname}</span>,
          <span key="p" className="font-mono text-xs">{r.numero_patrimonio ?? "—"}</span>,
          r.tipo,
          r.setor ?? "—",
          r.usuarios?.nome ?? "—",
          statusBadge(r.status_ciclo_vida),
          <div key="a" className="flex gap-1">
            {canWrite && (
              <>
                <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
              </>
            )}
          </div>,
        ])}
      />

      <CrudDialog
        title={editing ? "Editar ativo" : "Novo ativo"}
        open={open}
        onOpenChange={setOpen}
        onSubmit={save}
        trigger={null}
      >
        <div>
          <Label>Hostname</Label>
          <Input required value={form.hostname} onChange={(e) => setForm({ ...form, hostname: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo</Label>
            <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nº série</Label>
            <Input value={form.numero_serie} onChange={(e) => setForm({ ...form, numero_serie: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Setor</Label>
            <Input value={form.setor} onChange={(e) => setForm({ ...form, setor: e.target.value })} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status_ciclo_vida} onValueChange={(v) => setForm({ ...form, status_ciclo_vida: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Responsável</Label>
          <Select
            value={form.usuario_responsavel_id ?? "none"}
            onValueChange={(v) => setForm({ ...form, usuario_responsavel_id: v === "none" ? null : v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Nenhum —</SelectItem>
              {(users ?? []).map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CrudDialog>
    </>
  );
}
