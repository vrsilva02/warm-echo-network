import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Briefcase, Pencil, Trash2, ExternalLink } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useConfirm } from "@/components/confirm-dialog";

export const Route = createFileRoute("/_authenticated/clientes")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Clientes — GestoraIT" },
      { name: "description", content: "Cadastro de clientes e visão dos ativos, contratos e licenças de cada um." },
    ],
  }),
});

type Row = {
  id: string;
  nome: string;
  codigo: string | null;
  documento: string | null;
  contato: string | null;
  email: string | null;
  telefone: string | null;
  observacao: string | null;
  ativo: boolean;
};

const initial = {
  nome: "",
  codigo: "",
  documento: "",
  contato: "",
  email: "",
  telefone: "",
  observacao: "",
  ativo: true,
};

function Page() {
  const { canWrite } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState(initial);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*").order("nome");
      if (error) throw error;
      return data as Row[];
    },
  });

  const { data: counts } = useQuery({
    queryKey: ["clientes-counts"],
    queryFn: async () => {
      const [a, c, l] = await Promise.all([
        supabase.from("ativos").select("cliente_id"),
        supabase.from("contratos").select("cliente_id"),
        supabase.from("licencas").select("cliente_id, quantidade"),
      ]);
      const acc: Record<string, { ativos: number; contratos: number; licencas: number }> = {};
      const bump = (id: string | null, k: "ativos" | "contratos" | "licencas", n = 1) => {
        if (!id) return;
        acc[id] ??= { ativos: 0, contratos: 0, licencas: 0 };
        acc[id][k] += n;
      };
      (a.data ?? []).forEach((r: any) => bump(r.cliente_id, "ativos"));
      (c.data ?? []).forEach((r: any) => bump(r.cliente_id, "contratos"));
      (l.data ?? []).forEach((r: any) => bump(r.cliente_id, "licencas", r.quantidade ?? 0));
      return acc;
    },
  });

  function openNew() { setEditing(null); setForm(initial); setOpen(true); }
  function openEdit(r: Row) {
    setEditing(r);
    setForm({
      nome: r.nome,
      codigo: r.codigo ?? "",
      documento: r.documento ?? "",
      contato: r.contato ?? "",
      email: r.email ?? "",
      telefone: r.telefone ?? "",
      observacao: r.observacao ?? "",
      ativo: r.ativo,
    });
    setOpen(true);
  }

  async function save() {
    const payload = {
      nome: form.nome.trim(),
      codigo: form.codigo.trim() || null,
      documento: form.documento.trim() || null,
      contato: form.contato.trim() || null,
      email: form.email.trim() || null,
      telefone: form.telefone.trim() || null,
      observacao: form.observacao.trim() || null,
      ativo: form.ativo,
    };
    const { error } = editing
      ? await supabase.from("clientes").update(payload).eq("id", editing.id)
      : await supabase.from("clientes").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    qc.invalidateQueries({ queryKey: ["clientes"] });
  }

  async function remove(r: Row) {
    const c = counts?.[r.id];
    const ok = await confirm({
      title: "Excluir cliente?",
      description: "Ativos, contratos e licenças vinculados ficarão sem cliente associado (não serão apagados).",
      tone: "danger",
      impact: [
        { label: "Cliente", value: r.nome },
        { label: "Ativos vinculados", value: c?.ativos ?? 0, tone: (c?.ativos ?? 0) > 0 ? "danger" : "default" },
        { label: "Contratos vinculados", value: c?.contratos ?? 0, tone: (c?.contratos ?? 0) > 0 ? "danger" : "default" },
        { label: "Seats de licença", value: c?.licencas ?? 0 },
      ],
      confirmLabel: "Excluir",
    });
    if (!ok) return;
    const { error } = await supabase.from("clientes").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["clientes"] });
    qc.invalidateQueries({ queryKey: ["clientes-counts"] });
  }

  const columns: Column<Row>[] = [
    {
      id: "nome", header: "Cliente",
      accessor: (r) => (
        <Link to="/clientes/$id" params={{ id: r.id }} className="font-medium hover:underline">{r.nome}</Link>
      ),
      sortValue: (r) => r.nome.toLowerCase(), searchValue: (r) => r.nome, exportValue: (r) => r.nome,
    },
    { id: "codigo", header: "Código", accessor: (r) => r.codigo ?? "—", searchValue: (r) => r.codigo, exportValue: (r) => r.codigo },
    {
      id: "documento", header: "CNPJ / CPF",
      accessor: (r) => <span className="font-mono text-xs">{r.documento ?? "—"}</span>,
      searchValue: (r) => r.documento, exportValue: (r) => r.documento,
    },
    { id: "contato", header: "Contato", accessor: (r) => r.contato ?? "—", searchValue: (r) => r.contato, exportValue: (r) => r.contato },
    { id: "email", header: "E-mail", defaultHidden: true, accessor: (r) => r.email ?? "—", searchValue: (r) => r.email, exportValue: (r) => r.email },
    { id: "telefone", header: "Telefone", defaultHidden: true, accessor: (r) => r.telefone ?? "—", exportValue: (r) => r.telefone },
    {
      id: "ativos", header: "Ativos",
      accessor: (r) => <span className="tabular-nums">{counts?.[r.id]?.ativos ?? 0}</span>,
      sortValue: (r) => counts?.[r.id]?.ativos ?? 0, exportValue: (r) => String(counts?.[r.id]?.ativos ?? 0),
    },
    {
      id: "contratos", header: "Contratos",
      accessor: (r) => <span className="tabular-nums">{counts?.[r.id]?.contratos ?? 0}</span>,
      sortValue: (r) => counts?.[r.id]?.contratos ?? 0, exportValue: (r) => String(counts?.[r.id]?.contratos ?? 0),
    },
    {
      id: "licencas", header: "Seats de licença",
      accessor: (r) => <span className="tabular-nums">{counts?.[r.id]?.licencas ?? 0}</span>,
      sortValue: (r) => counts?.[r.id]?.licencas ?? 0, exportValue: (r) => String(counts?.[r.id]?.licencas ?? 0),
    },
    {
      id: "status", header: "Status",
      accessor: (r) => <StatusPill tone={r.ativo ? "ok" : "neutral"}>{r.ativo ? "Ativo" : "Inativo"}</StatusPill>,
      exportValue: (r) => (r.ativo ? "ativo" : "inativo"),
    },
    {
      id: "acoes", header: "Ações", alwaysVisible: true,
      accessor: (r) => (
        <div className="flex gap-1">
          <Button asChild size="icon" variant="ghost" title="Ver ficha do cliente">
            <Link to="/clientes/$id" params={{ id: r.id }}><ExternalLink className="h-4 w-4" /></Link>
          </Button>
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
        title="Clientes"
        description="Cadastre clientes para associar ativos, contratos e licenças e saber o que existe em cada um."
        actions={canWrite ? <Button size="sm" onClick={openNew}>Novo cliente</Button> : undefined}
      />
      <AdvancedTable<Row>
        storageKey="clientes"
        rows={rows}
        isLoading={isLoading}
        columns={columns}
        getRowId={(r) => r.id}
        exportFilename="clientes"
        emptyState={
          <EmptyState
            icon={<Briefcase className="h-6 w-6" />}
            title="Sem clientes cadastrados"
            description="Cadastre o primeiro cliente para segmentar ativos, contratos e licenças."
            action={canWrite ? <Button size="sm" onClick={openNew}>Novo cliente</Button> : undefined}
          />
        }
      />
      <CrudDialog title={editing ? "Editar cliente" : "Novo cliente"} open={open} onOpenChange={setOpen} onSubmit={save} trigger={null}>
        <div><Label>Nome *</Label><Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Código</Label><Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="Ex.: CLI-001" /></div>
          <div><Label>CNPJ / CPF</Label><Input value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Contato</Label><Input value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} /></div>
          <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
        </div>
        <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><Label>Observação</Label><Textarea rows={3} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} /></div>
        <div className="flex items-center gap-2">
          <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} id="cli-ativo" />
          <Label htmlFor="cli-ativo">Cliente ativo</Label>
        </div>
      </CrudDialog>
    </>
  );
}
