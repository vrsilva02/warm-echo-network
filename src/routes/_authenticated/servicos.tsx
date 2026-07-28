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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/combobox";
import { StatusPill, type StatusTone } from "@/components/status-pill";
import { Boxes, Pencil, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useConfirm } from "@/components/confirm-dialog";

export const Route = createFileRoute("/_authenticated/servicos")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Serviços de Negócio — GestoraIT" },
      { name: "description", content: "Catálogo de serviços de negócio e sua dependência de ativos." },
    ],
  }),
});

type Row = {
  id: string;
  nome: string;
  criticidade: string | null;
  responsavel_id: string | null;
  usuarios?: { nome: string } | null;
};
const CRIT = ["baixa", "media", "alta", "critica"];
const initial = { nome: "", criticidade: "media", responsavel_id: null as string | null };

export function criticidadeTone(c: string | null | undefined): StatusTone {
  if (c === "critica") return "critical";
  if (c === "alta") return "warn";
  if (c === "media") return "info";
  return "neutral";
}

function Page() {
  const { canWrite } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState(initial);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["servicos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("servicos").select("id,nome,criticidade,responsavel_id, usuarios:usuarios!responsavel_id(nome)").order("nome");
      if (error) throw error;
      return data as unknown as Row[];
    },
  });
  const { data: counts } = useQuery({
    queryKey: ["servicos-ativos-count"],
    queryFn: async () => {
      const { data } = await supabase.from("ativos_servicos").select("servico_id");
      const m: Record<string, number> = {};
      (data ?? []).forEach((r: any) => { if (r.servico_id) m[r.servico_id] = (m[r.servico_id] ?? 0) + 1; });
      return m;
    },
  });
  const { data: users } = useQuery({
    queryKey: ["usuarios-lite"],
    queryFn: async () => (await supabase.from("usuarios").select("id,nome").eq("status", "ativo").order("nome")).data ?? [],
  });

  function openNew() { setEditing(null); setForm(initial); setOpen(true); }
  function openEdit(r: Row) {
    setEditing(r);
    setForm({ nome: r.nome, criticidade: r.criticidade ?? "media", responsavel_id: r.responsavel_id });
    setOpen(true);
  }
  async function save() {
    const payload = { nome: form.nome.trim(), criticidade: form.criticidade, responsavel_id: form.responsavel_id };
    if (!payload.nome) return toast.error("Informe o nome");
    const { error } = editing
      ? await supabase.from("servicos").update(payload).eq("id", editing.id)
      : await supabase.from("servicos").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    qc.invalidateQueries({ queryKey: ["servicos"] });
  }
  async function remove(r: Row) {
    const ok = await confirm({
      title: "Excluir serviço?",
      description: "Todas as vinculações com ativos serão removidas.",
      tone: "danger",
      impact: [{ label: "Serviço", value: r.nome }, { label: "Ativos vinculados", value: counts?.[r.id] ?? 0 }],
      confirmLabel: "Excluir",
    });
    if (!ok) return;
    const { error } = await supabase.from("servicos").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["servicos"] });
  }

  const columns: Column<Row>[] = [
    {
      id: "nome", header: "Serviço",
      accessor: (r) => (
        <Link to="/servicos/$id" params={{ id: r.id }} className="font-medium hover:underline inline-flex items-center gap-1">
          {r.nome} <ExternalLink className="h-3 w-3 opacity-60" />
        </Link>
      ),
      sortValue: (r) => r.nome, searchValue: (r) => r.nome, exportValue: (r) => r.nome,
    },
    {
      id: "crit", header: "Criticidade",
      accessor: (r) => <StatusPill tone={criticidadeTone(r.criticidade)}>{r.criticidade ?? "—"}</StatusPill>,
      sortValue: (r) => r.criticidade ?? "", exportValue: (r) => r.criticidade,
    },
    {
      id: "resp", header: "Responsável",
      accessor: (r) => r.usuarios?.nome ?? "—",
      sortValue: (r) => r.usuarios?.nome ?? "", exportValue: (r) => r.usuarios?.nome,
    },
    {
      id: "ativos", header: "Ativos", accessor: (r) => <span className="font-mono tabular-nums">{counts?.[r.id] ?? 0}</span>,
      sortValue: (r) => counts?.[r.id] ?? 0, exportValue: (r) => counts?.[r.id] ?? 0,
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

  return (
    <>
      <PageHeader
        title="Serviços de Negócio"
        description="Catálogo de serviços e sua dependência da infraestrutura."
        actions={canWrite ? <Button size="sm" onClick={openNew}>Novo serviço</Button> : undefined}
      />
      <AdvancedTable<Row>
        storageKey="servicos"
        rows={rows}
        isLoading={isLoading}
        columns={columns}
        getRowId={(r) => r.id}
        exportFilename="servicos"
        emptyState={
          <EmptyState
            icon={<Boxes className="h-6 w-6" />}
            title="Nenhum serviço cadastrado"
            description="Cadastre serviços de negócio e vincule aos ativos que os sustentam."
            action={canWrite ? <Button size="sm" onClick={openNew}>Novo serviço</Button> : undefined}
          />
        }
      />
      <CrudDialog title={editing ? "Editar serviço" : "Novo serviço"} open={open} onOpenChange={setOpen} onSubmit={save} trigger={null}>
        <div><Label>Nome *</Label><Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Criticidade</Label>
            <Select value={form.criticidade} onValueChange={(v) => setForm({ ...form, criticidade: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CRIT.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Responsável</Label>
            <Combobox
              placeholder="Nenhum"
              searchPlaceholder="Buscar colaborador…"
              value={form.responsavel_id}
              onChange={(v) => setForm({ ...form, responsavel_id: v })}
              options={(users ?? []).map((u: any) => ({ value: u.id, label: u.nome }))}
            />
          </div>
        </div>
      </CrudDialog>
    </>
  );
}
