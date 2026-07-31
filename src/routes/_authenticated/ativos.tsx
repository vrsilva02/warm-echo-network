import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, lazy, Suspense } from "react";
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
import { Pencil, Trash2, Laptop, ExternalLink, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { useConfirm } from "@/components/confirm-dialog";
import { Combobox } from "@/components/combobox";
import { ATIVO_TIPOS, ATIVO_CATEGORIAS, comValorAtual } from "@/lib/ativos-opcoes";
import { chunk } from "@/lib/bulk-import";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { EdrBadge, useGapEdrSet } from "@/components/edr-badge";
import { Link } from "@tanstack/react-router";

const AtivosImportExport = lazy(() =>
  import("@/components/ativos-import-export").then((m) => ({ default: m.AtivosImportExport })),
);

export const Route = createFileRoute("/_authenticated/ativos")({
  component: AtivosPage,
  head: () => ({
    meta: [
      { title: "Ativos — GestoraIT" },
      { name: "description", content: "Cadastro e ciclo de vida de ativos corporativos." },
    ],
  }),
});

type Ativo = {
  id: string;
  hostname: string;
  tipo: string | null;
  categoria: string | null;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  numero_patrimonio: string | null;
  setor: string | null;
  status_ciclo_vida: string;
  usuario_responsavel_id: string | null;
  centro_custo_id: string | null;
  cliente_id: string | null;
  usuarios?: { nome: string } | null;
  centros_custo?: { nome: string } | null;
  clientes?: { nome: string } | null;
};

const STATUS = ["solicitado", "estoque", "em_uso", "manutencao", "baixado"];

/** Converte valores legados de status para os aceitos pelo banco. */
function normalizeStatus(s: string | null | undefined): string {
  const v = (s ?? "").trim();
  if (v === "em_estoque") return "estoque";
  if (v === "em_manutencao") return "manutencao";
  return STATUS.includes(v) ? v : "estoque";
}


const initial = {
  hostname: "",
  tipo: null as string | null,
  categoria: "",
  marca: "",
  modelo: "",
  numero_serie: "",
  numero_patrimonio: "",
  setor: "",
  status_ciclo_vida: "estoque",
  usuario_responsavel_id: null as string | null,
  centro_custo_id: null as string | null,
  cliente_id: null as string | null,
};

function statusBadge(s: string) {
  const map: Record<string, string> = {
    em_uso: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
    estoque: "bg-primary/10 text-primary border-primary/30",
    em_estoque: "bg-primary/10 text-primary border-primary/30",
    solicitado: "bg-muted text-muted-foreground",
    manutencao: "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30",
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
  const [originalStatus, setOriginalStatus] = useState<string | null>(null);
  const [listState, setListState] = useState({
    page: 1,
    pageSize: 50,
    query: "",
    view: null as string | null,
    sort: null as { id: string; dir: "asc" | "desc" } | null,
  });

  const { data: ativosPage, isLoading } = useQuery({
    queryKey: ["ativos", "page", listState],
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const from = (listState.page - 1) * listState.pageSize;
      const to = from + listState.pageSize - 1;
      let query = supabase
        .from("ativos")
        .select("id,hostname,tipo,categoria,marca,modelo,numero_serie,numero_patrimonio,setor,status_ciclo_vida,usuario_responsavel_id,centro_custo_id,cliente_id,usuarios(nome),centros_custo(nome),clientes(nome)", { count: "exact" });

      const term = listState.query.trim().replace(/[%_,()]/g, " ");
      if (term) {
        query = query.or(`hostname.ilike.%${term}%,numero_patrimonio.ilike.%${term}%,numero_serie.ilike.%${term}%,tipo.ilike.%${term}%,categoria.ilike.%${term}%,marca.ilike.%${term}%,modelo.ilike.%${term}%,setor.ilike.%${term}%,status_ciclo_vida.ilike.%${term}%`);
      }
      if (listState.view === "em_uso") query = query.eq("status_ciclo_vida", "em_uso");
      if (listState.view === "estoque") query = query.in("status_ciclo_vida", ["estoque", "em_estoque"]);
      if (listState.view === "manutencao") query = query.in("status_ciclo_vida", ["manutencao", "em_manutencao"]);
      if (listState.view === "sem_patrimonio") query = query.is("numero_patrimonio", null);
      if (listState.view === "sem_tipo") query = query.is("tipo", null);
      if (listState.view === "sem_categoria") query = query.is("categoria", null);

      const sortColumns: Record<string, string> = {
        hostname: "hostname", patrimonio: "numero_patrimonio", tipo: "tipo", categoria: "categoria",
        marca: "marca", modelo: "modelo", setor: "setor", status: "status_ciclo_vida",
      };
      const sortColumn = listState.sort ? sortColumns[listState.sort.id] : "hostname";
      const { data, error, count } = await query
        .order(sortColumn ?? "hostname", { ascending: listState.sort?.dir !== "desc", nullsFirst: false })
        .order("id", { ascending: true })
        .range(from, to);
      if (error) throw error;
      return { rows: (data ?? []) as Ativo[], total: count ?? 0 };
    },
  });
  const rows = ativosPage?.rows;


  const { data: users } = useQuery({
    queryKey: ["usuarios-lite"],
    queryFn: async () => (await supabase.from("usuarios").select("id,nome").eq("status", "ativo").order("nome")).data ?? [],
  });
  const { data: centros } = useQuery({
    queryKey: ["centros_custo-lite"],
    queryFn: async () => (await supabase.from("centros_custo").select("id,nome").order("nome")).data ?? [],
  });
  const { data: clientes } = useQuery({
    queryKey: ["clientes-lite"],
    queryFn: async () => (await supabase.from("clientes").select("id,nome").eq("ativo", true).order("nome")).data ?? [],
  });
  const { set: edrSet } = useGapEdrSet(rows?.map((row) => row.id));

  useEffect(() => {
    const channel = supabase
      .channel("ativos-list-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "ativos" }, () => {
        void qc.invalidateQueries({ queryKey: ["ativos"] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [qc]);

  function openNew() {
    setEditing(null);
    setOriginalStatus(null);
    setForm(initial);
    setOpen(true);
  }
  function openEdit(r: Ativo) {
    const normalizedStatus = normalizeStatus(r.status_ciclo_vida);
    setEditing(r);
    setOriginalStatus(r.status_ciclo_vida);
    setForm({
      hostname: r.hostname,
      tipo: r.tipo ?? null,
      categoria: r.categoria ?? "",
      marca: r.marca ?? "",
      modelo: r.modelo ?? "",
      numero_serie: r.numero_serie ?? "",
      numero_patrimonio: r.numero_patrimonio ?? "",
      setor: r.setor ?? "",
      status_ciclo_vida: normalizedStatus,
      usuario_responsavel_id: r.usuario_responsavel_id,
      centro_custo_id: r.centro_custo_id,
      cliente_id: r.cliente_id,
    });
    setOpen(true);
  }

  async function save() {
    const payload = {
      hostname: form.hostname.trim(),
      tipo: form.tipo?.trim() || null,
      categoria: form.categoria.trim() || null,
      marca: form.marca.trim() || null,
      modelo: form.modelo.trim() || null,
      numero_serie: form.numero_serie || null,
      numero_patrimonio: form.numero_patrimonio.trim() || null,
      setor: form.setor || null,
      status_ciclo_vida: normalizeStatus(form.status_ciclo_vida),
      usuario_responsavel_id: form.usuario_responsavel_id,
      centro_custo_id: form.centro_custo_id,
      cliente_id: form.cliente_id,
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
    const deleted: string[] = [];
    const falhas: string[] = [];
    for (const lote of chunk(ids, 100)) {
      const { data, error } = await supabase.from("ativos").delete().in("id", lote).select("id");
      if (error) {
        falhas.push(error.message);
        continue;
      }
      deleted.push(...(data ?? []).map((d: { id: string }) => d.id));
    }
    if (deleted.length > 0) {
      void logAction("BULK_DELETE", "ativos", { ids: deleted, total: deleted.length });
    }
    qc.invalidateQueries({ queryKey: ["ativos"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    const naoExcluidos = ids.length - deleted.length;
    if (naoExcluidos > 0) {
      toast.error(
        `${deleted.length} de ${ids.length} excluído(s). ${naoExcluidos} não pôde(m) ser excluído(s)` +
          (falhas.length ? `: ${falhas[0]}` : " — sem permissão ou registro já removido."),
      );
    } else {
      toast.success(`${deleted.length} ativo(s) excluído(s)`);
    }
    clear();
  }

  const columns: Column<Ativo>[] = [
    {
      id: "hostname", header: "Hostname",
      accessor: (r) => (
        <span className="font-medium inline-flex items-center gap-1.5">
          <Link to="/ativos/$id" params={{ id: r.id }} className="hover:underline">{r.hostname}</Link>
          <EdrBadge ativoId={r.id} set={edrSet} />
        </span>
      ),
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
      accessor: (r) => r.tipo ?? <span className="text-muted-foreground">Sem tipo</span>,
      sortValue: (r) => r.tipo ?? "",
      searchValue: (r) => r.tipo ?? "Sem tipo", exportValue: (r) => r.tipo,
    },
    {
      id: "categoria", header: "Categoria",
      accessor: (r) => r.categoria ?? <span className="text-muted-foreground">Sem categoria</span>,
      sortValue: (r) => r.categoria ?? "",
      searchValue: (r) => r.categoria ?? "Sem categoria", exportValue: (r) => r.categoria,
    },

    {
      id: "marca", header: "Marca",
      accessor: (r) => r.marca ?? "—", sortValue: (r) => r.marca ?? "",
      searchValue: (r) => r.marca, exportValue: (r) => r.marca,
    },
    {
      id: "modelo", header: "Modelo",
      accessor: (r) => r.modelo ?? "—", sortValue: (r) => r.modelo ?? "",
      searchValue: (r) => r.modelo, exportValue: (r) => r.modelo,
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
      id: "cliente", header: "Cliente",
      accessor: (r) => r.clientes?.nome ?? "—",
      sortValue: (r) => r.clientes?.nome ?? "",
      searchValue: (r) => r.clientes?.nome, exportValue: (r) => r.clientes?.nome,
    },
    {
      id: "centro", header: "Centro de custo", defaultHidden: true,
      accessor: (r) => r.centros_custo?.nome ?? "—",
      sortValue: (r) => r.centros_custo?.nome ?? "",
      searchValue: (r) => r.centros_custo?.nome, exportValue: (r) => r.centros_custo?.nome,
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
          <Button asChild size="icon" variant="ghost" title="Ver ficha">
            <Link to="/ativos/$id" params={{ id: r.id }}><ExternalLink className="h-4 w-4" /></Link>
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

  const views: SavedView<Ativo>[] = [
    { id: "em_uso", label: "Em uso", filter: (rs) => rs.filter((r) => r.status_ciclo_vida === "em_uso") },
    { id: "estoque", label: "Em estoque", filter: (rs) => rs.filter((r) => r.status_ciclo_vida === "estoque" || r.status_ciclo_vida === "em_estoque") },
    { id: "manutencao", label: "Manutenção", filter: (rs) => rs.filter((r) => r.status_ciclo_vida === "manutencao" || r.status_ciclo_vida === "em_manutencao") },
    { id: "sem_patrimonio", label: "Sem patrimônio", filter: (rs) => rs.filter((r) => !r.numero_patrimonio) },
    { id: "sem_tipo", label: "Sem tipo", filter: (rs) => rs.filter((r) => !r.tipo?.trim()) },
    { id: "sem_categoria", label: "Sem categoria", filter: (rs) => rs.filter((r) => !r.categoria?.trim()) },
  ];


  return (
    <>
      <PageHeader
        title="Ativos"
        description="Notebooks, desktops, servidores e VDIs — com ciclo de vida controlado."
        actions={
          <div className="flex items-center gap-2">
            <Suspense fallback={null}>
            <AtivosImportExport
              canWrite={canWrite}
              onImported={() => {
                qc.invalidateQueries({ queryKey: ["ativos"] });
                qc.invalidateQueries({ queryKey: ["dashboard"] });
              }}
            />
            </Suspense>
            {canWrite && <Button size="sm" onClick={openNew}>Novo ativo</Button>}
          </div>
        }
      />
      <AdvancedTable<Ativo>
        storageKey="ativos"
        rows={rows}
        isLoading={isLoading}
        serverPagination={{
          total: ativosPage?.total ?? 0,
          page: listState.page,
          pageSize: listState.pageSize,
          onPageChange: (page) => setListState((state) => ({ ...state, page })),
          onPageSizeChange: (pageSize) => setListState((state) => ({ ...state, page: 1, pageSize })),
          onSearchChange: (query) => setListState((state) => state.query === query ? state : ({ ...state, page: 1, query })),
          onViewChange: (view) => setListState((state) => ({ ...state, page: 1, view })),
          onSortChange: (sort) => setListState((state) => ({ ...state, page: 1, sort })),
        }}
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
            <Label>Tipo <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Combobox
              placeholder="Selecione o tipo"
              searchPlaceholder="Buscar tipo…"
              clearable
              value={form.tipo}
              onChange={(v) => setForm({ ...form, tipo: v })}
              options={comValorAtual(ATIVO_TIPOS, form.tipo).map((t) => ({ value: t, label: t }))}
            />
          </div>
          <div>
            <Label>Nº série</Label>
            <Input value={form.numero_serie} onChange={(e) => setForm({ ...form, numero_serie: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>Categoria <span className="text-muted-foreground font-normal">(opcional)</span></Label>
          <Combobox
            placeholder="Selecione a categoria"
            searchPlaceholder="Buscar categoria…"
            clearable
            value={form.categoria || null}
            onChange={(v) => setForm({ ...form, categoria: v ?? "" })}
            options={comValorAtual(ATIVO_CATEGORIAS, form.categoria).map((c) => ({ value: c, label: c }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Marca</Label>
            <Input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} placeholder="Ex.: Dell" />
          </div>
          <div>
            <Label>Modelo</Label>
            <Input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} placeholder="Ex.: Latitude 5440" />
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
            <div className="flex items-center gap-1.5">
              <Label className="mb-0">Status</Label>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="h-5 w-5 -ml-1 text-muted-foreground hover:text-foreground">
                      <HelpCircle className="h-4 w-4" />
                      <span className="sr-only">Sobre os valores de status</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs space-y-1.5">
                    <p className="font-medium">Status aceitos pelo banco</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      <li><span className="font-mono">solicitado</span></li>
                      <li><span className="font-mono">estoque</span></li>
                      <li><span className="font-mono">em_uso</span></li>
                      <li><span className="font-mono">manutencao</span></li>
                      <li><span className="font-mono">baixado</span></li>
                    </ul>
                    <p className="text-muted-foreground pt-1 border-t border-primary-foreground/20">
                      Rótulos legados <span className="font-mono">em_estoque</span> e <span className="font-mono">em_manutencao</span> são convertidos automaticamente para <span className="font-mono">estoque</span> e <span className="font-mono">manutencao</span>.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Select value={form.status_ciclo_vida} onValueChange={(v) => setForm({ ...form, status_ciclo_vida: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
            </Select>
            {editing && originalStatus && originalStatus !== form.status_ciclo_vida && (
              <div className="mt-2 rounded-md bg-[color:var(--warning)]/10 border border-[color:var(--warning)]/30 px-3 py-2 text-sm">
                <p className="font-medium text-[color:var(--warning)]">Conversão de status legado</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-foreground/90">
                  <span>Status anterior: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{originalStatus}</code></span>
                  <span>→</span>
                  <span>Status convertido: <code className="rounded bg-[color:var(--success)]/15 px-1.5 py-0.5 text-xs text-[color:var(--success)]">{form.status_ciclo_vida}</code></span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Responsável</Label>
            <Combobox
              placeholder="Nenhum"
              searchPlaceholder="Buscar colaborador…"
              value={form.usuario_responsavel_id}
              onChange={(v) => setForm({ ...form, usuario_responsavel_id: v })}
              options={(users ?? []).map((u) => ({ value: u.id, label: u.nome }))}
            />
          </div>
          <div>
            <Label>Centro de custo <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Combobox
              placeholder="Nenhum"
              searchPlaceholder="Buscar centro…"
              clearable
              value={form.centro_custo_id}
              onChange={(v) => setForm({ ...form, centro_custo_id: v })}
              options={(centros ?? []).map((c: any) => ({ value: c.id, label: c.nome }))}
            />
          </div>

        </div>
        <div>
          <Label>Cliente</Label>
          <Combobox
            placeholder="Nenhum"
            searchPlaceholder="Buscar cliente…"
            value={form.cliente_id}
            onChange={(v) => setForm({ ...form, cliente_id: v })}
            options={(clientes ?? []).map((c: any) => ({ value: c.id, label: c.nome }))}
          />
        </div>
      </CrudDialog>
    </>
  );
}
