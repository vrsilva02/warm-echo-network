import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, FileText, Save, Repeat, Trash2, Play, RefreshCw } from "lucide-react";
import { exportXLSXInBackground, downloadPDF, downloadXLSX } from "@/lib/export";
import { logAction } from "@/lib/audit";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useConfirm } from "@/components/confirm-dialog";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";

export const Route = createFileRoute("/_authenticated/relatorios")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Relatórios — GestoraIT" },
      { name: "description", content: "Construtor de relatórios com filtros combináveis e envios recorrentes." },
    ],
  }),
});

/* ------------------------------ Tipos & Presets ------------------------------ */

type ReportType =
  | "elp"
  | "licencas_usuarios_desligados"
  | "custo_licencas_ociosas"
  | "historico_ativo"
  | "gap_edr"
  | "ordens_servico";

type Filters = {
  categoria?: string | null;
  fabricanteId?: string | null;
  unidadeId?: string | null;
  statusCompliance?: string | null;
  statusAtivo?: string | null;
  statusUsuario?: string | null;
  vencInicio?: string | null;
  vencFim?: string | null;
  ativoId?: string | null;
  periodoInicio?: string | null;
  periodoFim?: string | null;
  statusOS?: string | null;
};

const REPORT_META: Record<ReportType, { title: string; desc: string; usesFilters: (keyof Filters)[] }> = {
  elp: {
    title: "Posição de licenciamento por contrato (ELP)",
    desc: "Compradas x alocadas, saldo e status de compliance.",
    usesFilters: ["categoria", "fabricanteId", "statusCompliance"],
  },
  licencas_usuarios_desligados: {
    title: "Licenças atribuídas a usuários desligados",
    desc: "Alocações ativas cujo colaborador foi desligado.",
    usesFilters: ["categoria", "fabricanteId"],
  },
  custo_licencas_ociosas: {
    title: "Custo de licenças ociosas por período",
    desc: "Licenças não alocadas × custo unitário no período.",
    usesFilters: ["categoria", "fabricanteId", "periodoInicio", "periodoFim"],
  },
  historico_ativo: {
    title: "Histórico completo de um ativo",
    desc: "Todos os vínculos e desvínculos de licenças do ativo escolhido.",
    usesFilters: ["ativoId", "periodoInicio", "periodoFim"],
  },
  gap_edr: {
    title: "Ativos sem cobertura de EDR (Kaspersky)",
    desc: "Ativos ativos que não possuem licença EDR vinculada.",
    usesFilters: ["statusAtivo", "unidadeId"],
  },
  ordens_servico: {
    title: "Relatório de Ordens de Serviço",
    desc: "Listagem detalhada de manutenções, defeitos e custos.",
    usesFilters: ["periodoInicio", "periodoFim", "statusOS"],
  },
};

/* ------------------------------ Página ------------------------------ */

function Page() {
  const [tipo, setTipo] = useState<ReportType>("elp");
  const [filters, setFilters] = useState<Filters>({});
  const [lastExecutedFilters, setLastExecutedFilters] = useState<Filters | null>(null);
  const [recOpen, setRecOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Construa relatórios com filtros combináveis. Salve como recorrente para envio mensal."
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)]">
        <ShortcutsPanel current={tipo} onPick={(t) => { 
          setTipo(t); 
          setFilters({}); 
          setLastExecutedFilters(null);
        }} />
        <div className="space-y-4 min-w-0">
          <FiltersCard 
            tipo={tipo} 
            filters={filters} 
            onChange={setFilters} 
            onExecute={() => setLastExecutedFilters({ ...filters })}
          />
          <ReportRunner 
            tipo={tipo} 
            filters={lastExecutedFilters} 
            onSaveRecurring={() => setRecOpen(true)} 
          />
          <RecurringList />
        </div>
      </div>
      <RecurringDialog open={recOpen} onOpenChange={setRecOpen} tipo={tipo} filters={filters} />
    </>
  );
}

/* ------------------------------ Atalhos ------------------------------ */

function ShortcutsPanel({ current, onPick }: { current: ReportType; onPick: (t: ReportType) => void }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Atalhos</CardTitle></CardHeader>
      <CardContent className="p-2 pt-0">
        <div className="space-y-1">
          {(Object.keys(REPORT_META) as ReportType[]).map((k) => (
            <button
              key={k}
              onClick={() => onPick(k)}
              className={`w-full text-left rounded-md p-2 text-sm border transition ${
                current === k ? "bg-primary/5 border-primary/30" : "hover:bg-muted/50 border-transparent"
              }`}
            >
              <div className="font-medium leading-tight">{REPORT_META[k].title}</div>
              <div className="text-xs text-muted-foreground leading-tight mt-0.5">{REPORT_META[k].desc}</div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Filtros ------------------------------ */

function FiltersCard({ 
  tipo, 
  filters, 
  onChange,
  onExecute
}: { 
  tipo: ReportType; 
  filters: Filters; 
  onChange: (f: Filters) => void;
  onExecute: () => void;
}) {
  const uses = REPORT_META[tipo].usesFilters;

  const { data: fabricantes } = useQuery({
    queryKey: ["fabricantes-opts"],
    queryFn: async () => (await supabase.from("fabricantes").select("id, nome").order("nome")).data ?? [],
  });
  const { data: unidades } = useQuery({
    queryKey: ["unidades-opts"],
    queryFn: async () => (await supabase.from("unidades").select("id, nome").order("nome")).data ?? [],
  });
  const { data: ativos } = useQuery({
    queryKey: ["ativos-opts"],
    queryFn: async () => (await supabase.from("ativos").select("id, hostname").order("hostname")).data ?? [],
    enabled: uses.includes("ativoId"),
  });

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Filtros</CardTitle>
        <Button size="sm" onClick={onExecute}>
          <Play className="h-4 w-4 mr-2" /> Gerar Relatório
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {uses.includes("categoria") && (
            <div>
              <Label>Categoria</Label>
              <Select value={filters.categoria ?? "todas"} onValueChange={(v) => set("categoria", v === "todas" ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {["Windows", "Office", "EDR", "Outro"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {uses.includes("fabricanteId") && (
            <div>
              <Label>Fabricante</Label>
              <Select value={filters.fabricanteId ?? "todos"} onValueChange={(v) => set("fabricanteId", v === "todos" ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {(fabricantes ?? []).map((f: any) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {uses.includes("unidadeId") && (
            <div>
              <Label>Unidade / setor</Label>
              <Select value={filters.unidadeId ?? "todas"} onValueChange={(v) => set("unidadeId", v === "todas" ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {(unidades ?? []).map((u: any) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {uses.includes("statusCompliance") && (
            <div>
              <Label>Compliance</Label>
              <Select value={filters.statusCompliance ?? "todos"} onValueChange={(v) => set("statusCompliance", v === "todos" ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ok">OK</SelectItem>
                  <SelectItem value="ocioso">Ocioso</SelectItem>
                  <SelectItem value="deficit">Déficit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {uses.includes("statusAtivo") && (
            <div>
              <Label>Status do ativo</Label>
              <Select value={filters.statusAtivo ?? "ativo"} onValueChange={(v) => set("statusAtivo", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["ativo", "manutencao", "estoque", "baixado"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {uses.includes("vencInicio") && (
            <>
              <div><Label>Vencimento de</Label><Input type="date" value={filters.vencInicio ?? ""} onChange={(e) => set("vencInicio", e.target.value || null)} /></div>
              <div><Label>Até</Label><Input type="date" value={filters.vencFim ?? ""} onChange={(e) => set("vencFim", e.target.value || null)} /></div>
            </>
          )}
          {uses.includes("periodoInicio") && (
            <>
              <div><Label>Período de</Label><Input type="date" value={filters.periodoInicio ?? ""} onChange={(e) => set("periodoInicio", e.target.value || null)} /></div>
              <div><Label>Até</Label><Input type="date" value={filters.periodoFim ?? ""} onChange={(e) => set("periodoFim", e.target.value || null)} /></div>
            </>
          )}
          {uses.includes("ativoId") && (
            <div className="sm:col-span-2">
              <Label>Ativo</Label>
              <Select value={filters.ativoId ?? ""} onValueChange={(v) => set("ativoId", v || null)}>
                <SelectTrigger><SelectValue placeholder="Selecione um ativo" /></SelectTrigger>
                <SelectContent>
                  {(ativos ?? []).map((a: any) => <SelectItem key={a.id} value={a.id}>{a.hostname}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {uses.includes("statusOS") && (
            <div>
              <Label>Status da OS</Label>
              <Select value={filters.statusOS ?? "todos"} onValueChange={(v) => set("statusOS", v === "todos" ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="aberta">Aberta</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="aguardando_peca">Aguardando peça</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Execução ------------------------------ */

async function runReport(tipo: ReportType, f: Filters): Promise<{ columns: string[]; rows: any[][]; duration: number; timestamp: Date }> {
  const start = performance.now();
  let result: { columns: string[]; rows: any[][] } = { columns: [], rows: [] };


  if (tipo === "elp") {
    let q = supabase.from("vw_elp").select("*");
    if (f.categoria) q = q.eq("categoria", f.categoria);
    if (f.statusCompliance) q = q.eq("status_compliance", f.statusCompliance);
    
    const { data: rows } = await q.order("nome_oficial");
    let filtered = rows ?? [];

    if (f.fabricanteId) {
      const { data: prods } = await supabase.from("produtos_catalogo").select("id").eq("fabricante_id", f.fabricanteId);
      const ids = new Set((prods ?? []).map((p: any) => p.id));
      filtered = filtered.filter((r: any) => ids.has(r.produto_id));
    }

    result = {
      columns: ["Produto", "Fabricante", "Categoria", "Compradas", "Alocadas", "Saldo", "Status"],
      rows: filtered.map((r: any) => [r.nome_oficial, r.fabricante ?? "—", r.categoria, r.licencas_compradas, r.licencas_alocadas, r.saldo, r.status_compliance]),
    };
  } else if (tipo === "licencas_usuarios_desligados") {
    const { data } = await supabase
      .from("alocacoes")
      .select("id, data_inicio, usuarios!inner(nome, status), licencas!inner(produto_id, produtos_catalogo!inner(nome_oficial, categoria, fabricante_id, fabricantes(nome)))")
      .is("data_fim", null)
      .eq("usuarios.status", "desligado");
    let rowsData = (data ?? []).filter((r: any) => {
      const p = r.licencas?.produtos_catalogo;
      if (f.categoria && p?.categoria !== f.categoria) return false;
      if (f.fabricanteId && p?.fabricante_id !== f.fabricanteId) return false;
      return true;
    });
    result = {
      columns: ["Colaborador", "Produto", "Fabricante", "Categoria", "Desde"],
      rows: rowsData.map((r: any) => [
        r.usuarios?.nome,
        r.licencas?.produtos_catalogo?.nome_oficial,
        r.licencas?.produtos_catalogo?.fabricantes?.nome ?? "—",
        r.licencas?.produtos_catalogo?.categoria,
        r.data_inicio,
      ]),
    };
  } else if (tipo === "custo_licencas_ociosas") {
    const { data: elp } = await supabase.from("vw_elp").select("*");
    const { data: licencas } = await supabase.from("licencas").select("produto_id, quantidade, custo_unitario, created_at");
    
    const filteredLicencas = (licencas ?? []).filter(l => {
      if (f.periodoInicio && l.created_at && l.created_at < f.periodoInicio) return false;
      if (f.periodoFim && l.created_at && l.created_at > f.periodoFim + "T23:59:59") return false;
      return true;
    });

    const custoMedio = new Map<string, number>();
    filteredLicencas.forEach((l: any) => {
      if (l.custo_unitario == null) return;
      const cur = custoMedio.get(l.produto_id);
      custoMedio.set(l.produto_id, cur == null ? Number(l.custo_unitario) : (cur + Number(l.custo_unitario)) / 2);
    });
    let rowsData = (elp ?? []).filter((r: any) => {
      if (f.categoria && r.categoria !== f.categoria) return false;
      const ociosas = Math.max(0, (r.licencas_compradas ?? 0) - (r.licencas_alocadas ?? 0));
      return ociosas > 0;
    });
    if (f.fabricanteId) {
      const { data: prods } = await supabase.from("produtos_catalogo").select("id").eq("fabricante_id", f.fabricanteId);
      const ids = new Set((prods ?? []).map((p: any) => p.id));
      rowsData = rowsData.filter((r: any) => ids.has(r.produto_id));
    }
    result = {
      columns: ["Produto", "Categoria", "Compradas", "Alocadas", "Ociosas", "Custo unit. médio", "Custo ocioso"],
      rows: rowsData.map((r: any) => {
        const ociosas = Math.max(0, (r.licencas_compradas ?? 0) - (r.licencas_alocadas ?? 0));
        const c = custoMedio.get(r.produto_id) ?? 0;
        return [
          r.nome_oficial, r.categoria, r.licencas_compradas, r.licencas_alocadas, ociosas,
          c ? c.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—",
          c ? (ociosas * c).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—",
        ];
      }),
    };
  } else if (tipo === "historico_ativo") {
    if (!f.ativoId) {
      result = { columns: ["Aviso"], rows: [["Selecione um ativo para gerar o histórico."]] };
    } else {
      let q = supabase
        .from("alocacoes")
        .select("id, data_inicio, data_fim, observacao, licencas(produto_id, produtos_catalogo(nome_oficial, categoria))")
        .eq("ativo_id", f.ativoId);

      if (f.periodoInicio) q = q.gte("data_inicio", f.periodoInicio);
      if (f.periodoFim) q = q.lte("data_inicio", f.periodoFim);

      const { data } = await q.order("data_inicio", { ascending: false });
      result = {
        columns: ["Produto", "Categoria", "Início", "Fim", "Duração", "Observação"],
        rows: (data ?? []).map((r: any) => {
          const ini = r.data_inicio ? new Date(r.data_inicio) : null;
          const fim = r.data_fim ? new Date(r.data_fim) : null;
          const dur = ini ? Math.round(((fim ?? new Date()).getTime() - ini.getTime()) / 86400000) : "";
          return [
            r.licencas?.produtos_catalogo?.nome_oficial ?? "—",
            r.licencas?.produtos_catalogo?.categoria ?? "—",
            r.data_inicio ?? "",
            r.data_fim ?? "ativa",
            dur !== "" ? `${dur}d` : "",
            r.observacao ?? "",
          ];
        }),
      };
    }
  } else if (tipo === "gap_edr") {
    let q = supabase.from("ativos").select("id, hostname, tipo, status_ciclo_vida, unidade_id, unidades(nome)");
    q = q.eq("status_ciclo_vida", f.statusAtivo ?? "ativo");
    if (f.unidadeId) q = q.eq("unidade_id", f.unidadeId);
    const { data: ativos } = await q;
    const { data: aloc } = await supabase
      .from("alocacoes")
      .select("ativo_id, licencas!inner(produtos_catalogo!inner(categoria))")
      .is("data_fim", null)
      .eq("licencas.produtos_catalogo.categoria", "EDR");
    const cobertos = new Set((aloc ?? []).map((a: any) => a.ativo_id));
    const sem = (ativos ?? []).filter((a: any) => !cobertos.has(a.id));
    result = {
      columns: ["Hostname", "Tipo", "Unidade", "Status"],
      rows: sem.map((a: any) => [a.hostname, a.tipo, a.unidades?.nome ?? "—", a.status_ciclo_vida]),
    };
  } else if (tipo === "ordens_servico") {
    let q = supabase
      .from("ordens_servico")
      .select("numero, status, prioridade, descricao_defeito, data_abertura, data_conclusao, custo_total, ativos(hostname), usuarios:aberto_por(nome)");

    if (f.statusOS) q = q.eq("status", f.statusOS as any);
    if (f.periodoInicio) q = q.gte("data_abertura", f.periodoInicio + "T00:00:00.000Z");
    if (f.periodoFim) q = q.lte("data_abertura", f.periodoFim + "T23:59:59.999Z");

    const { data } = await q.order("data_abertura", { ascending: false });

    result = {
      columns: ["Número", "Status", "Prioridade", "Ativo", "Aberto por", "Abertura", "Conclusão", "Custo"],
      rows: (data ?? []).map((os: any) => [
        `#${os.numero}`,
        os.status,
        os.prioridade,
        os.ativos?.hostname ?? "—",
        os.usuarios?.nome ?? "—",
        os.data_abertura ? new Date(os.data_abertura).toLocaleDateString("pt-BR") : "—",
        os.data_conclusao ? new Date(os.data_conclusao).toLocaleDateString("pt-BR") : "—",
        os.custo_total ? os.custo_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—",
      ]),
    };
  }

  return { 
    columns: result.columns, 
    rows: result.rows, 
    duration: performance.now() - start, 
    timestamp: new Date() 
  };
}

function ReportRunner({ 
  tipo, 
  filters, 
  onSaveRecurring 
}: { 
  tipo: ReportType; 
  filters: Filters | null; 
  onSaveRecurring: () => void 
}) {
  const meta = REPORT_META[tipo];
  const { data, isLoading, isFetching, refetch, error, isError } = useQuery({
    queryKey: ["report-run", tipo, filters],
    queryFn: async () => {
      if (!filters) return { columns: [], rows: [], duration: 0, timestamp: new Date() };
      const toastId = toast.loading(`Sincronizando ${meta.title.toLowerCase()}...`);
      try {
        const res = await runReport(tipo, filters);
        toast.success(`${meta.title} sincronizado`, { 
          id: toastId,
          description: `${res.rows.length} registros em ${res.duration.toFixed(0)}ms`
        });
        return res;
      } catch (err) {
        toast.error(`Falha ao sincronizar ${meta.title}`, { 
          id: toastId,
          description: err instanceof Error ? err.message : "Erro desconhecido" 
        });
        throw err;
      }
    },
    refetchInterval: 15000,
    enabled: !!filters,
    retry: 2,
  });

  useRealtimeInvalidate({
    channel: `relatorios-sync-${tipo}`,
    table: tipo === "ordens_servico" ? "ordens_servico" : 
           tipo === "elp" ? "vw_elp" : 
           tipo === "historico_ativo" ? "alocacoes" : 
           "licencas",
    queryKeys: [["report-run", tipo]],
    enabled: !!filters,
  });

  const rows = data?.rows ?? [];
  const columns = data?.columns ?? [];
  const stamp = new Date().toISOString().slice(0, 10);
  const filterLabel = filters ? Object.entries(filters).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(" · ") : "Aguardando execução";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
        <div>
          <CardTitle className="text-base">{meta.title}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">{meta.desc}</p>
        </div>
        <div className="flex flex-col items-end gap-2 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => refetch()} 
              disabled={isFetching}
              className={isFetching ? "animate-pulse" : ""}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} /> 
              {isFetching ? "Sincronizando..." : "Atualizar agora"}
            </Button>
            <Button size="sm" variant="outline" disabled={rows.length === 0} onClick={() => {
              void downloadXLSX(
                `${tipo}-${stamp}.xlsx`,
                columns,
                rows,
                meta.title.slice(0, 31)
              );
              void logAction("EXPORT", tipo, { formato: "xlsx", total: rows.length, filtros: filters ?? {} });
            }}><Download className="h-4 w-4 mr-2" /> XLSX</Button>
            <Button size="sm" disabled={rows.length === 0} onClick={() => {
              downloadPDF({ filename: `${tipo}-${stamp}.pdf`, title: meta.title, subtitle: filterLabel, columns, rows });
              void logAction("EXPORT", tipo, { formato: "pdf", total: rows.length, filtros: filters ?? {} });
            }}><FileText className="h-4 w-4 mr-2" /> PDF</Button>
            <Button size="sm" variant="secondary" onClick={onSaveRecurring}><Save className="h-4 w-4 mr-2" /> Salvar recorrente</Button>
          </div>
          {data && (
            <div className="flex gap-3 text-[10px] text-muted-foreground bg-muted/30 px-2 py-1 rounded border">
              <span>Última sincronização: <strong>{data.timestamp.toLocaleTimeString("pt-BR")}</strong></span>
              <span>Duração: <strong>{data.duration.toFixed(0)}ms</strong></span>
              <span>Registros: <strong>{rows.length}</strong></span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!filters ? (
          <EmptyState 
            icon={<Play className="h-6 w-6" />} 
            title="Relatório pronto para execução" 
            description="Configure os filtros acima e clique em 'Gerar Relatório' para visualizar a prévia." 
          />
        ) : isError ? (
          <div className="p-8 border-2 border-dashed border-destructive/20 rounded-lg bg-destructive/5 text-center">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-3">
              <Trash2 className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-destructive">Falha na sincronização</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-[280px] mx-auto">
              {error instanceof Error ? error.message : "Ocorreu um erro ao carregar os dados do relatório."}
            </p>
            <Button size="sm" variant="outline" className="mt-4" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : isLoading || isFetching ? (
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse mb-2">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Sincronizando dados com o banco de dados...
            </div>
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<FileText className="h-6 w-6" />} title="Sem resultados" description="Ajuste os filtros e execute novamente." />
        ) : (
          <div className="overflow-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>{columns.map((c) => <th key={c} className="text-left p-2 font-medium">{c}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 500).map((r, i) => (
                  <tr key={i} className="border-t">
                    {r.map((cell, j) => <td key={j} className="p-2 tabular-nums">{cell == null ? "—" : String(cell)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 500 && (
              <div className="p-2 text-xs text-muted-foreground border-t bg-muted/30">
                Exibindo 500 de {rows.length} linhas — exporte para ver o total.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Recorrências ------------------------------ */

function RecurringDialog({
  open, onOpenChange, tipo, filters,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; tipo: ReportType; filters: Filters;
}) {
  const qc = useQueryClient();
  const [nome, setNome] = useState(REPORT_META[tipo].title);
  const [freq, setFreq] = useState<"diario" | "semanal" | "mensal">("mensal");
  const [formato, setFormato] = useState<"xlsx" | "pdf">("pdf");
  const [destinatarios, setDestinatarios] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const list = destinatarios.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) { setBusy(false); return toast.error("Informe ao menos um destinatário"); }
    const { error } = await supabase.from("relatorios_recorrentes").insert({
      nome, tipo, filtros: filters as any, frequencia: freq, formato, destinatarios: list, ativo: true,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Recorrência salva. O envio automático será ativado quando o domínio de e-mail for configurado.");
    qc.invalidateQueries({ queryKey: ["recorrentes"] });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Salvar como recorrente</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Frequência</Label>
              <Select value={freq} onValueChange={(v) => setFreq(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="diario">Diário</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Formato</Label>
              <Select value={formato} onValueChange={(v) => setFormato(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="xlsx">XLSX</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Destinatários (e-mails separados por vírgula)</Label>
            <Textarea rows={2} value={destinatarios} onChange={(e) => setDestinatarios(e.target.value)} placeholder="fulano@empresa.com, ciclano@empresa.com" />
          </div>
          <div className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
            <strong>Filtros atuais:</strong> {Object.entries(filters).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(" · ") || "nenhum"}
          </div>
          <p className="text-xs text-muted-foreground">
            A configuração é armazenada agora. O envio automático por e-mail entra em produção quando o domínio próprio for configurado.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RecurringList() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { canWrite } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["recorrentes"],
    queryFn: async () => (await supabase.from("relatorios_recorrentes").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  async function toggle(id: string, ativo: boolean) {
    await supabase.from("relatorios_recorrentes").update({ ativo: !ativo }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["recorrentes"] });
  }
  async function remove(id: string, nome: string) {
    const ok = await confirm({ title: "Excluir recorrência?", description: nome, tone: "danger", confirmLabel: "Excluir" });
    if (!ok) return;
    await supabase.from("relatorios_recorrentes").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["recorrentes"] });
  }

  const rows = (data ?? []) as any[];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2"><Repeat className="h-4 w-4" /> Relatórios recorrentes</CardTitle>
        <Badge variant="outline" className="text-xs">{rows.length}</Badge>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">Nenhuma recorrência cadastrada.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-2 font-medium">Nome</th>
                  <th className="text-left p-2 font-medium">Tipo</th>
                  <th className="text-left p-2 font-medium">Frequência</th>
                  <th className="text-left p-2 font-medium">Formato</th>
                  <th className="text-left p-2 font-medium">Destinatários</th>
                  <th className="text-left p-2 font-medium">Status</th>
                  <th className="w-24 p-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2 font-medium">{r.nome}</td>
                    <td className="p-2 text-xs">{r.tipo}</td>
                    <td className="p-2">{r.frequencia}</td>
                    <td className="p-2 uppercase text-xs">{r.formato}</td>
                    <td className="p-2 text-xs">{(r.destinatarios ?? []).join(", ")}</td>
                    <td className="p-2">
                      <Badge variant={r.ativo ? "default" : "secondary"}>{r.ativo ? "ativo" : "pausado"}</Badge>
                    </td>
                    <td className="p-2 text-right">
                      {canWrite && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => toggle(r.id, r.ativo)}>{r.ativo ? "Pausar" : "Ativar"}</Button>
                          <Button size="icon" variant="ghost" onClick={() => remove(r.id, r.nome)}><Trash2 className="h-4 w-4" /></Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
