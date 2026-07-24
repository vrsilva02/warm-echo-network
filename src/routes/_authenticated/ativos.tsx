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
import { Pencil, Trash2, Laptop } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { useConfirm } from "@/components/confirm-dialog";
import { Combobox } from "@/components/combobox";

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
  const confirm = useConfirm();
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

  async function remove(row: Ativo) {
    const { count: alocCount } = await supabase
      .from("alocacoes").select("id", { count: "exact", head: true })
      .eq("ativo_id", row.id).is("data_fim", null);
    const ok = await confirm({
      title: "Excluir este ativo?",
      description: "Esta ação é irreversível. Prefira baixar o ativo para manter o histórico.",
      tone: "danger",
      impact: [
        { label: "Ativo", value: row.hostname },
        { label: "Status atual", value: row.status_ciclo_vida },
        { label: "Alocações ativas afetadas", value: alocCount ?? 0, tone: (alocCount ?? 0) > 0 ? "danger" : "default" },
      ],
      confirmLabel: "Excluir",
    });
    if (!ok) return;
    const { error } = await supabase.from("ativos").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Ativo excluído");
    qc.invalidateQueries({ queryKey: ["ativos"] });
  }

  async function bulkBaixar(rows: Ativo[], clear: () => void) {
    const alvos = rows.filter((r) => r.status_ciclo_vida !== "baixado");
    if (alvos.length === 0) return toast.info("Nada a baixar");
    const ok = await confirm({
      title: `Baixar ${alvos.length} ativo(s)?`,
      description: "Ativos baixados têm suas alocações encerradas e liberam licenças.",
      tone: "warn",
      impact: [
        { label: "Selecionados", value: rows.length },
        { label: "Serão baixados", value: alvos.length },
        { label: "Já baixados ignorados", value: rows.length - alvos.length },
      ],
      confirmLabel: "Baixar",
    });
    if (!ok) return;
    const ids = alvos.map((r) => r.id);
    const { error } = await supabase.from("ativos").update({ status_ciclo_vida: "baixado" }).in("id", ids);
    if (error) return toast.error(error.message);
    void logAction("BULK_UPDATE", "ativos", { operacao: "baixar", ids, total: ids.length });
    toast.success(`${ids.length} ativo(s) baixado(s)`);
    clear();
    qc.invalidateQueries({ queryKey: ["ativos"] });
    qc.invalidateQueries({ queryKey: ["alocacoes"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }
  async function bulkDelete(rows: Ativo[], clear: () => void) {
    const ok = await confirm({
      title: `Excluir ${rows.length} ativo(s)?`,
      description: "Ação irreversível. Considere baixar em vez de excluir para manter histórico.",
      tone: "danger",
      impact: [
        { label: "Ativos a excluir", value: rows.length, tone: "danger" },
      ],
      confirmLabel: "Excluir todos",
    });
    if (!ok) return;
    const ids = rows.map((r) => r.id);
    const { error } = await supabase.from("ativos").delete().in("id", ids);
    if (error) return toast.error(error.message);
    void logAction("BULK_DELETE", "ativos", { ids, total: ids.length });
    toast.success("Excluídos");
    clear();
    qc.invalidateQueries({ queryKey: ["ativos"] });
  }

  const columns: Column<Ativo>[] = [
    {
      id: "hostname", header: "Hostname",
      accessor: (r) => <span className="font-medium">{r.hostname}</span>,
      sortValue: (r) => r.hostname.toLowerCase(),
      searchValue: (r) => r.hostname, exportValue: (r) => r.hostname,
    },
    {
      id: "patrimonio", header: "Patrimônio",
      accessor: (r) => <span className="font-mono text-xs">{r.numero_patrimonio ?? "—"}</span>,
      sortValue: (r) => r.numero_patrimonio ?? "",
      searchValue: (r) => r.numero_patrimonio, exportValue: (r) => r.numero_patrimonio,
    },
    {
      id: "tipo", header: "Tipo",
      accessor: (r) => r.tipo, sortValue: (r) => r.tipo,
      searchValue: (r) => r.tipo, exportValue: (r) => r.tipo,
    },
    {
      id: "serie", header: "Nº Série", defaultHidden: true,
      accessor: (r) => <span className="font-mono text-xs">{r.numero_serie ?? "—"}</span>,
      searchValue: (r) => r.numero_serie, exportValue: (r) => r.numero_serie,
    },
    {
      id: "setor", header: "Setor",
      accessor: (r) => r.setor ?? "—", sortValue: (r) => r.setor ?? "",
      searchValue: (r) => r.setor, exportValue: (r) => r.setor,
    },
    {
      id: "responsavel", header: "Responsável",
      accessor: (r) => r.usuarios?.nome ?? "—",
      sortValue: (r) => r.usuarios?.nome ?? "",
      searchValue: (r) => r.usuarios?.nome, exportValue: (r) => r.usuarios?.nome,
    },
    {
      id: "status", header: "Status",
      accessor: (r) => statusBadge(r.status_ciclo_vida),
      sortValue: (r) => r.status_ciclo_vida,
      searchValue: (r) => r.status_ciclo_vida, exportValue: (r) => r.status_ciclo_vida,
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

  const views: SavedView<Ativo>[] = [
    { id: "em_uso", label: "Em uso", filter: (rs) => rs.filter((r) => r.status_ciclo_vida === "em_uso") },
    { id: "estoque", label: "Em estoque", filter: (rs) => rs.filter((r) => r.status_ciclo_vida === "em_estoque") },
    { id: "manutencao", label: "Manutenção", filter: (rs) => rs.filter((r) => r.status_ciclo_vida === "em_manutencao") },
    { id: "sem_patrimonio", label: "Sem patrimônio", filter: (rs) => rs.filter((r) => !r.numero_patrimonio) },
  ];

  return (
    <>
      <PageHeader
        title="Ativos"
        description="Notebooks, desktops, servidores e VDIs — com ciclo de vida controlado."
        actions={canWrite ? <Button size="sm" onClick={openNew}>Novo ativo</Button> : undefined}
      />
      <AdvancedTable<Ativo>
        storageKey="ativos"
        rows={rows}
        isLoading={isLoading}
        columns={columns}
        getRowId={(r) => r.id}
        savedViews={views}
        exportFilename="ativos"
        emptyState={
          <EmptyState
            icon={<Laptop className="h-6 w-6" />}
            title="Nenhum ativo cadastrado"
            description="Registre notebooks, desktops, servidores e VDIs para controlar o ciclo de vida."
            action={canWrite ? <Button size="sm" onClick={openNew}>Novo ativo</Button> : undefined}
          />
        }
        bulkActions={canWrite ? (sel, clear) => (
          <>
            <Button size="sm" variant="outline" onClick={() => bulkBaixar(sel, clear)}>Baixar selecionados</Button>
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => bulkDelete(sel, clear)}>Excluir</Button>
          </>
        ) : undefined}
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
        <div>
          <Label>Nº patrimônio</Label>
          <Input
            value={form.numero_patrimonio}
            onChange={(e) => setForm({ ...form, numero_patrimonio: e.target.value })}
            placeholder="Ex.: PAT-000123"
          />
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
