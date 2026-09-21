import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, ArrowRight, TrendingDown } from "lucide-react";
import { lazy, Suspense, useEffect } from "react";

const ElpBarChart = lazy(() => import("@/components/dashboard-charts").then((m) => ({ default: m.ElpBarChart })));
const CicloVidaPieChart = lazy(() => import("@/components/dashboard-charts").then((m) => ({ default: m.CicloVidaPieChart })));
const TcoCentroBarChart = lazy(() => import("@/components/dashboard-charts").then((m) => ({ default: m.TcoCentroBarChart })));
const ComplianceTrendChart = lazy(() => import("@/components/dashboard-charts").then((m) => ({ default: m.ComplianceTrendChart })));

function ChartFallback() {
  return <div className="h-full w-full animate-pulse rounded-md bg-muted/50" />;
}
import {
  AlertTriangle, CheckCircle2, XCircle, KeySquare, FileWarning, Snowflake,
  ShieldAlert, Coins, Settings2, Wrench, Package, Building2, Boxes,
  Clock, ChevronRight,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@tanstack/react-router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Dashboard — GestoraIT" },
      { name: "description", content: "Visão geral de compliance, licenças e ativos." },
    ],
  }),
});

type ElpRow = {
  produto_id: string;
  nome_oficial: string;
  categoria: string;
  fabricante: string | null;
  licencas_compradas: number;
  licencas_alocadas: number;
  saldo: number;
  status_compliance: "ok" | "ocioso" | "deficit";
};

type Sev = "critico" | "alto" | "medio";
type AlertaItem = {
  id: string;
  tipo: "contrato" | "compliance" | "ocioso" | "edr";
  severidade: Sev;
  titulo: string;
  descricao: string;
  acaoLink: string;
};

// ── Snapshot de compliance para tendência real ──────────────────────────────
const TREND_KEY = "gestorait.compliance.trend";
type TrendPoint = { date: string; compliance: number };

function loadTrend(): TrendPoint[] {
  try { return JSON.parse(localStorage.getItem(TREND_KEY) ?? "[]") as TrendPoint[]; } catch { return []; }
}
function saveTrendPoint(compliance: number) {
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const updated = [...loadTrend().filter((p) => p.date !== today), { date: today, compliance }].slice(-14);
  try { localStorage.setItem(TREND_KEY, JSON.stringify(updated)); } catch {}
}

// ── Data fetching ───────────────────────────────────────────────────────────
function useDashboardData() {
  return useQuery({
    queryKey: ["dashboard"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const [elp, ativos, vencendo, indicadores, ocioseFin, risco, custoOc, gapEdr, tco, osAbertas, osAguardando, pecasRep, defRec] = await Promise.all([
        supabase.from("vw_elp").select("*"),
        supabase.from("ativos").select("id, status_ciclo_vida, centro_custo_id, centros_custo(nome)"),
        supabase.from("vw_contratos_vencendo").select("id,dias_para_vencer,urgencia,fornecedor,numero_contrato,data_fim"),
        supabase.from("vw_licencas_indicadores").select("*"),
        supabase.from("vw_ociosidade_financeira").select("*"),
        supabase.rpc("fn_risco_compliance", { _categoria: null as unknown as string }),
        supabase.from("vw_custo_ociosas").select("*"),
        supabase.from("vw_gap_edr").select("ativo_id,hostname,setor,status_ciclo_vida"),
        supabase.from("vw_tco_ativo").select("ativo_id,tco_anual_estimado"),
        (supabase as any).from("ordens_servico").select("id", { count: "exact", head: true }).in("status", ["aberta", "em_andamento"]),
        (supabase as any).from("ordens_servico").select("id", { count: "exact", head: true }).eq("status", "aguardando_peca"),
        (supabase as any).from("vw_pecas_reposicao").select("peca_id"),
        (supabase as any).from("vw_ativos_defeito_recorrente").select("ativo_id"),
      ]);
      return {
        elp: (elp.data ?? []) as ElpRow[],
        ativos: ativos.data ?? [],
        contratosVencendo30: (vencendo.data ?? []).filter((r: any) => r.dias_para_vencer <= 30).length,
        contratosVencendoRaw: (vencendo.data ?? []) as any[],
        licencasOciosas: (indicadores.data ?? []).reduce((acc, curr) => acc + (curr.disponiveis ?? 0), 0),
        ocioseFin: (ocioseFin.data ?? []) as Array<{ produto_id: string; nome_oficial: string; valor_ocioso: number }>,
        risco: (risco.data ?? []) as Array<{ score: number }>,
        custoOciosasMensal: (custoOc.data ?? []).reduce((a: number, r: any) => a + Number(r.custo_mensal_desperdicado ?? 0), 0),
        gapEdrRaw: (gapEdr.data ?? []) as any[],
        tco: (tco.data ?? []) as Array<{ ativo_id: string; tco_anual_estimado: number | null }>,
        osAbertasCount: (osAbertas as any).count ?? 0,
        osAguardandoPecaCount: (osAguardando as any).count ?? 0,
        pecasReposicaoCount: (pecasRep.data ?? []).length,
        defeitoRecorrenteCount: (defRec.data ?? []).length,
      };
    },
    retry: 3,
    retryDelay: (attempt) => Math.min(attempt * 1_000, 3_000),
  });
}

function useAtivosPorCliente() {
  return useQuery({
    queryKey: ["dashboard", "ativos-por-cliente"],
    staleTime: 30_000,
    refetchInterval: 30_000,
    queryFn: async () => {
      const [totalRes, clientesRes, semClienteRes] = await Promise.all([
        supabase.from("ativos").select("id", { count: "exact", head: true }),
        supabase.from("clientes").select("id,nome").order("nome"),
        supabase.from("ativos").select("id", { count: "exact", head: true }).is("cliente_id", null),
      ]);
      const clientes = (clientesRes.data ?? []) as Array<{ id: string; nome: string }>;
      const counts = await Promise.all(
        clientes.map(async (c) => {
          const { count } = await supabase.from("ativos").select("id", { count: "exact", head: true }).eq("cliente_id", c.id);
          return { id: c.id, nome: c.nome, total: count ?? 0 };
        }),
      );
      return { total: totalRes.count ?? 0, semCliente: semClienteRes.count ?? 0, porCliente: counts.sort((a, b) => b.total - a.total) };
    },
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function statusStyle(s: string) {
  if (s === "ok") return { label: "OK", cls: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30" };
  if (s === "ocioso") return { label: "Ocioso", cls: "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30" };
  return { label: "Déficit", cls: "bg-destructive/15 text-destructive border-destructive/30" };
}
function brl(v: number) {
  return `R$ ${Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
const SEV_ORDER: Record<Sev, number> = { critico: 0, alto: 1, medio: 2 };

function buildAlertas(data: ReturnType<typeof useDashboardData>["data"]): AlertaItem[] {
  if (!data) return [];
  const alertas: AlertaItem[] = [];
  for (const c of data.contratosVencendoRaw ?? []) {
    const dias = c.dias_para_vencer;
    if (dias == null || dias > 90) continue;
    const sev: Sev = dias < 0 ? "critico" : dias <= 30 ? "critico" : dias <= 60 ? "alto" : "medio";
    alertas.push({ id: `c-${c.id}`, tipo: "contrato", severidade: sev, titulo: `${c.fornecedor} — ${c.numero_contrato ?? "sem nº"}`, descricao: dias < 0 ? `Vencido há ${Math.abs(dias)} dia(s)` : `Vence em ${dias} dia(s)`, acaoLink: "/contratos" });
  }
  for (const p of data.elp ?? []) {
    if (p.status_compliance !== "deficit") continue;
    const excesso = Number(p.licencas_alocadas) - Number(p.licencas_compradas);
    alertas.push({ id: `d-${p.produto_id}`, tipo: "compliance", severidade: excesso > 10 ? "critico" : "alto", titulo: `Déficit em ${p.nome_oficial}`, descricao: `${excesso} licença(s) além do adquirido`, acaoLink: "/licencas" });
  }
  for (const g of data.gapEdrRaw ?? []) {
    alertas.push({ id: `e-${g.ativo_id}`, tipo: "edr", severidade: "alto", titulo: `${g.hostname ?? "Ativo"} sem EDR`, descricao: `Setor ${g.setor ?? "—"} · ${g.status_ciclo_vida}`, acaoLink: "/alertas" });
  }
  return alertas.sort((a, b) => SEV_ORDER[a.severidade] - SEV_ORDER[b.severidade]);
}

// ── Components ───────────────────────────────────────────────────────────────

function KpiCard({ title, value, icon, hint, to, search, tone }: {
  title: string; value: number | string; icon: React.ReactNode; hint?: string;
  to?: string; search?: Record<string, string>; tone?: "ok" | "warn" | "danger";
}) {
  const toneClass = tone === "ok" ? "text-[color:var(--success)]" : tone === "warn" ? "text-[color:var(--warning)]" : tone === "danger" ? "text-destructive" : "";
  const inner = (
    <Card className={cn("elevate min-w-0 group relative", to && "cursor-pointer hover:border-primary/40 hover:shadow-lg transition-all duration-200", tone === "danger" && "border-destructive/30", tone === "warn" && "border-[color:var(--warning)]/30")}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="eyebrow flex min-w-0 flex-1 items-start gap-1.5 pt-0.5 text-[0.6875rem] leading-[1.35]">
          <span className="min-w-0">{title}</span>
          {hint && (
            <UITooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="Sobre este indicador" className="shrink-0 text-muted-foreground/60 hover:text-foreground">
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">{hint}</TooltipContent>
            </UITooltip>
          )}
        </CardTitle>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent className="flex items-end justify-between">
        <div className={cn("metric text-[1.75rem] leading-none", toneClass)}>{value}</div>
        {to && <ArrowRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-all duration-200" />}
      </CardContent>
    </Card>
  );
  if (!to) return inner;
  return <Link to={to as any} search={search as any} className="block">{inner}</Link>;
}

function SevDot({ sev }: { sev: Sev }) {
  const cls = sev === "critico" ? "bg-destructive" : sev === "alto" ? "bg-[color:var(--warning)]" : "bg-muted-foreground/50";
  return <span className={cn("h-2 w-2 rounded-full shrink-0 mt-1", cls)} />;
}

function TipoBadgeMini({ tipo }: { tipo: AlertaItem["tipo"] }) {
  const map = { contrato: "Contrato", compliance: "Compliance", ocioso: "Ocioso", edr: "Gap EDR" } as const;
  return <Badge variant="outline" className="text-[10px] h-4 px-1.5">{map[tipo]}</Badge>;
}

function AlertBanner({ alertas }: { alertas: AlertaItem[] }) {
  const criticos = alertas.filter((a) => a.severidade === "critico").length;
  const altos = alertas.filter((a) => a.severidade === "alto").length;
  if (alertas.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-[color:var(--success)]/30 bg-[color:var(--success)]/5 px-4 py-3 mb-6">
        <CheckCircle2 className="h-4 w-4 text-[color:var(--success)] shrink-0" />
        <span className="text-sm text-[color:var(--success)] font-medium">Tudo em conformidade — nenhum alerta ativo no momento.</span>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 mb-6 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-destructive/20">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <span className="text-sm font-semibold text-destructive">{alertas.length} alerta{alertas.length > 1 ? "s" : ""} ativo{alertas.length > 1 ? "s" : ""}</span>
          {criticos > 0 && <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30 text-[10px] h-4 px-1.5">{criticos} crítico{criticos > 1 ? "s" : ""}</Badge>}
          {altos > 0 && <Badge variant="outline" className="bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30 text-[10px] h-4 px-1.5">{altos} alto{altos > 1 ? "s" : ""}</Badge>}
        </div>
        <Button asChild size="sm" variant="outline" className="h-7 text-xs gap-1 border-destructive/30 text-destructive hover:bg-destructive/10">
          <Link to="/alertas">Ver todos <ArrowRight className="h-3 w-3" /></Link>
        </Button>
      </div>
      <div className="divide-y divide-destructive/10">
        {alertas.slice(0, 5).map((a) => (
          <Link key={a.id} to={a.acaoLink as any} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-destructive/5 transition-colors group">
            <div className="flex items-start gap-2.5 min-w-0">
              <SevDot sev={a.severidade} />
              <div className="min-w-0">
                <span className="text-xs font-medium truncate block">{a.titulo}</span>
                <span className="text-[10px] text-muted-foreground">{a.descricao}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <TipoBadgeMini tipo={a.tipo} />
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function AtivosPorClienteCard() {
  const { data, isLoading } = useAtivosPorCliente();
  const navigate = useNavigate();
  const total = data?.total ?? 0;
  const linhas = [...(data?.porCliente ?? []), ...((data?.semCliente ?? 0) > 0 ? [{ id: "__sem__", nome: "Sem cliente", total: data!.semCliente }] : [])];

  function navigateCliente(id: string) {
    try { localStorage.setItem("tbl:ativos:clienteId", id === "__sem__" ? "sem_cliente" : id); } catch {}
    void navigate({ to: "/ativos" });
  }

  return (
    <Card className="lg:col-span-3">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" /> Ativos por cliente</CardTitle>
          <Button asChild size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground">
            <Link to="/ativos">Ver todos <ArrowRight className="h-3 w-3" /></Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="py-6 text-center text-sm text-muted-foreground">Carregando…</div>
          : linhas.length === 0 ? <div className="py-6 text-center text-sm text-muted-foreground">Nenhum ativo cadastrado.</div>
          : (
            <div className="space-y-2">
              {linhas.map((c) => {
                const pct = total > 0 ? Math.round((c.total / total) * 100) : 0;
                return (
                  <button key={c.id} onClick={() => navigateCliente(c.id)} className="w-full text-left group rounded-md px-1 py-0.5 hover:bg-muted/60 transition-colors">
                    <div className="text-xs">
                      <div className="flex justify-between gap-2 mb-0.5">
                        <span className="truncate font-medium group-hover:text-primary transition-colors">{c.nome}</span>
                        <span className="font-mono tabular-nums text-muted-foreground">{c.total} · {pct}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
      </CardContent>
    </Card>
  );
}

const OCIOSAS_KEY = "gestorait.ociosas.limit";

function CustoOciosasCard({ valor }: { valor: number }) {
  const [limit, setLimit] = useState<number>(5000);
  useEffect(() => { const v = Number(localStorage.getItem(OCIOSAS_KEY) ?? "5000"); if (!Number.isNaN(v)) setLimit(v); }, []);
  function saveLimit(v: number) { setLimit(v); localStorage.setItem(OCIOSAS_KEY, String(v)); }
  const excede = valor > limit;
  return (
    <Link to="/alocacoes" className="block group">
      <Card className={cn("cursor-pointer group-hover:border-primary/40 group-hover:shadow-lg transition-all duration-200", excede && "border-destructive/40")}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><Snowflake className="h-3.5 w-3.5" /> Custo mensal em licenças ociosas</CardTitle>
          <div className="flex items-center gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button size="icon" variant="ghost" className="h-6 w-6" title="Definir limite" onClick={(e) => e.preventDefault()}>
                  <Settings2 className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56">
                <div className="space-y-2">
                  <Label className="text-xs">Limite de alerta (R$/mês)</Label>
                  <Input type="number" step="100" value={limit} onChange={(e) => saveLimit(Number(e.target.value) || 0)} />
                  <p className="text-[10px] text-muted-foreground">Destaca o card quando o valor ultrapassa este limite.</p>
                </div>
              </PopoverContent>
            </Popover>
            <ArrowRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-all" />
          </div>
        </CardHeader>
        <CardContent>
          <div className={cn("text-2xl font-semibold tabular-nums", excede ? "text-destructive" : "text-foreground")}>{brl(valor)}</div>
          <div className="text-[11px] text-muted-foreground mt-1">Limite: {brl(limit)}{excede && <span className="text-destructive font-medium"> · acima do limite</span>}</div>
        </CardContent>
      </Card>
    </Link>
  );
}

function TcoPorCentroCard({ tco, ativos }: { tco: Array<{ ativo_id: string; tco_anual_estimado: number | null }>; ativos: any[] }) {
  const map = new Map<string, number>();
  const nomes = new Map<string, string>();
  const byAtivo = new Map(tco.map((r) => [r.ativo_id, Number(r.tco_anual_estimado ?? 0)]));
  ativos.forEach((a) => { if (!a.centro_custo_id) return; nomes.set(a.centro_custo_id, a.centros_custo?.nome ?? "—"); map.set(a.centro_custo_id, (map.get(a.centro_custo_id) ?? 0) + (byAtivo.get(a.id) ?? 0)); });
  const rows = Array.from(map.entries()).map(([id, v]) => ({ nome: nomes.get(id) ?? "—", valor: v })).sort((a, b) => b.valor - a.valor).slice(0, 5);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><Coins className="h-3.5 w-3.5" /> TCO por centro de custo (top 5)</CardTitle>
      </CardHeader>
      <CardContent className="h-40 p-0 pl-2">
        {rows.length === 0 ? <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Sem centros vinculados.</div> : (
          <Suspense fallback={<ChartFallback />}><TcoCentroBarChart rows={rows} formatValue={brl} /></Suspense>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
function DashboardPage() {
  const { data, isLoading } = useDashboardData();
  const { data: ativosCliente } = useAtivosPorCliente();

  useRealtimeInvalidate({ channel: "dash-alocacoes", table: "alocacoes", queryKeys: [["dashboard"]] });
  useRealtimeInvalidate({ channel: "dash-ativos", table: "ativos", queryKeys: [["dashboard"], ["dashboard", "ativos-por-cliente"]] });
  useRealtimeInvalidate({ channel: "dash-licencas", table: "licencas", queryKeys: [["dashboard"]] });
  useRealtimeInvalidate({ channel: "dash-contratos", table: "contratos", queryKeys: [["dashboard"]] });
  useRealtimeInvalidate({ channel: "dash-clientes", table: "clientes", queryKeys: [["dashboard", "ativos-por-cliente"]] });

  const totais = { Windows: 0, Office: 0, EDR: 0 } as Record<string, number>;
  let compradas = 0, alocadas = 0;
  (data?.elp ?? []).forEach((r) => { totais[r.categoria] = (totais[r.categoria] ?? 0) + Number(r.licencas_compradas); compradas += Number(r.licencas_compradas); alocadas += Number(r.licencas_alocadas); });
  const compliance = compradas > 0 ? Math.min(100, Math.round(((compradas - Math.max(0, alocadas - compradas)) / compradas) * 100)) : 100;

  useEffect(() => { if (!isLoading && compradas > 0) saveTrendPoint(compliance); }, [isLoading, compliance, compradas]);

  const trendRaw = loadTrend();
  const trendData = trendRaw.length >= 2 ? trendRaw : [...trendRaw, { date: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), compliance }];

  const ativosCount: Record<string, number> = {};
  (data?.ativos ?? []).forEach((a: any) => { ativosCount[a.status_ciclo_vida] = (ativosCount[a.status_ciclo_vida] ?? 0) + 1; });
  const pieData = Object.entries(ativosCount).map(([name, value]) => ({ name, value }));

  const complianceCount = { ok: 0, ocioso: 0, deficit: 0 };
  (data?.elp ?? []).forEach((r) => { complianceCount[r.status_compliance]++; });

  const alertas = buildAlertas(data);
  const scoreMaxRisco = Math.round(Math.max(0, ...(data?.risco ?? []).map((r) => Number(r.score ?? 0))));
  const valorOcioso = (data?.ocioseFin ?? []).reduce((a, x) => a + Number(x.valor_ocioso ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Posição efetiva de licenças, contratos e ativos em tempo real."
        actions={
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link to="/alertas">
              <ShieldAlert className="h-3.5 w-3.5" />
              Central de alertas
              {alertas.length > 0 && <Badge className="ml-1 h-4 px-1.5 text-[10px] bg-destructive text-destructive-foreground">{alertas.length}</Badge>}
            </Link>
          </Button>
        }
      />

      <AlertBanner alertas={alertas} />

      {/* Ativos */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-5 mb-6">
        <KpiCard title="Total de ativos" value={ativosCliente?.total ?? 0} icon={<Boxes className="h-4 w-4" />} hint="Total de ativos cadastrados." to="/ativos" />
        <AtivosPorClienteCard />
      </div>

      {/* Licenças */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mb-6">
        <KpiCard title="Licenças Windows" value={totais.Windows ?? 0} icon={<KeySquare className="h-4 w-4" />} hint="Licenças contratadas da categoria Windows." to="/licencas" search={{ categoria: "Windows" }} />
        <KpiCard title="Licenças Office" value={totais.Office ?? 0} icon={<KeySquare className="h-4 w-4" />} hint="Licenças contratadas da categoria Office." to="/licencas" search={{ categoria: "Office" }} />
        <KpiCard title="Licenças EDR" value={totais.EDR ?? 0} icon={<KeySquare className="h-4 w-4" />} hint="Licenças contratadas para EDR/segurança." to="/licencas" search={{ categoria: "EDR" }} />
        <KpiCard title="Compliance geral" value={`${compliance}%`} icon={compliance >= 90 ? <CheckCircle2 className="h-4 w-4 text-[color:var(--success)]" /> : <TrendingDown className="h-4 w-4 text-[color:var(--warning)]" />} hint="% dentro do direito contratado. Abaixo de 100% = over-deployment." to="/licencas" tone={compliance >= 95 ? "ok" : compliance >= 80 ? "warn" : "danger"} />
      </div>

      {/* Status ELP */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-5 mb-6">
        <Link to="/licencas" search={{ status: "ativa" } as any} className="block group">
          <Card className="cursor-pointer group-hover:border-[color:var(--success)]/40 group-hover:shadow-lg transition-all duration-200">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center justify-between">Compliance OK <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-all" /></CardTitle></CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-2xl font-bold text-[color:var(--success)]">{complianceCount.ok}</div>
              <Badge variant="outline" className="bg-[color:var(--success)]/10 text-[color:var(--success)] border-[color:var(--success)]/20">Produtos em dia</Badge>
            </CardContent>
          </Card>
        </Link>
        <Link to="/licencas" search={{ status: "vencida" } as any} className="block group">
          <Card className="cursor-pointer group-hover:border-[color:var(--warning)]/40 group-hover:shadow-lg transition-all duration-200">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center justify-between">Ociosos / Risco <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-all" /></CardTitle></CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-2xl font-bold text-[color:var(--warning)]">{complianceCount.ocioso}</div>
              <Badge variant="outline" className="bg-[color:var(--warning)]/10 text-[color:var(--warning)] border-[color:var(--warning)]/20">Produtos ociosos</Badge>
            </CardContent>
          </Card>
        </Link>
        <Link to="/alertas" search={{ tipo: "compliance" } as any} className="block group">
          <Card className={cn("cursor-pointer group-hover:shadow-lg transition-all duration-200", complianceCount.deficit > 0 ? "border-destructive/30 group-hover:border-destructive/50" : "group-hover:border-border")}>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center justify-between">Déficit Crítico <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-all" /></CardTitle></CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className={cn("text-2xl font-bold", complianceCount.deficit > 0 ? "text-destructive" : "text-foreground")}>{complianceCount.deficit}</div>
              <Badge variant="outline" className={cn(complianceCount.deficit > 0 ? "bg-destructive/10 text-destructive border-destructive/20" : "text-muted-foreground")}>
                {complianceCount.deficit > 0 ? "Não conforme" : "Tudo OK"}
              </Badge>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Financeiro / Risco */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mb-6">
        <KpiCard title="Contratos vencendo em 30 dias" value={data?.contratosVencendo30 ?? 0} icon={<FileWarning className="h-4 w-4 text-[color:var(--warning)]" />} hint="Contratos com término nos próximos 30 dias." to="/contratos" tone={(data?.contratosVencendo30 ?? 0) > 0 ? "warn" : undefined} />
        <KpiCard title="Licenças ociosas" value={data?.licencasOciosas ?? 0} icon={<Snowflake className="h-4 w-4 text-primary" />} hint="Licenças em estoque não atribuídas a nenhum ativo." to="/alocacoes" />
        <KpiCard title="Valor financeiro ocioso" value={`R$ ${valorOcioso.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={<Coins className="h-4 w-4 text-[color:var(--warning)]" />} hint="Valor de aquisição das licenças disponíveis." to="/alocacoes" tone={valorOcioso > 0 ? "warn" : undefined} />
        <KpiCard title="Score máx. de risco" value={scoreMaxRisco} icon={<AlertTriangle className="h-4 w-4 text-destructive" />} hint="Maior score de risco entre categorias (0–100)." to="/alertas" search={{ tipo: "compliance" }} tone={scoreMaxRisco > 50 ? "danger" : scoreMaxRisco > 20 ? "warn" : undefined} />
      </div>

      {/* Custo ociosas + TCO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-5 mb-6">
        <CustoOciosasCard valor={data?.custoOciosasMensal ?? 0} />
        <TcoPorCentroCard tco={data?.tco ?? []} ativos={(data?.ativos ?? []) as any[]} />
      </div>

      {/* Manutenção */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mb-6">
        <KpiCard title="OS abertas" value={data?.osAbertasCount ?? 0} icon={<Wrench className="h-4 w-4 text-primary" />} hint="Ordens de serviço abertas ou em andamento." to="/ordens-servico" tone={(data?.osAbertasCount ?? 0) > 0 ? "warn" : undefined} />
        <KpiCard title="OS aguardando peça" value={data?.osAguardandoPecaCount ?? 0} icon={<Clock className="h-4 w-4 text-[color:var(--warning)]" />} hint="Reparos pausados aguardando reposição." to="/ordens-servico" tone={(data?.osAguardandoPecaCount ?? 0) > 0 ? "warn" : undefined} />
        <KpiCard title="Peças em reposição" value={data?.pecasReposicaoCount ?? 0} icon={<Package className="h-4 w-4 text-[color:var(--warning)]" />} hint="Peças abaixo do estoque mínimo." to="/pecas" tone={(data?.pecasReposicaoCount ?? 0) > 0 ? "warn" : undefined} />
        <KpiCard title="Defeito recorrente" value={data?.defeitoRecorrenteCount ?? 0} icon={<AlertTriangle className="h-4 w-4 text-destructive" />} hint="Ativos com 3+ OS nos últimos 6 meses." to="/ativos" tone={(data?.defeitoRecorrenteCount ?? 0) > 0 ? "danger" : undefined} />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              Tendência de Compliance (%)
              {trendRaw.length <= 2 && <span className="text-[10px] font-normal text-muted-foreground">Histórico acumulando…</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <Suspense fallback={<ChartFallback />}><ComplianceTrendChart data={trendData} /></Suspense>
          </CardContent>
        </Card>
        <Link to="/ativos" className="block group">
          <Card className="cursor-pointer group-hover:border-primary/40 group-hover:shadow-lg transition-all duration-200 h-full">
            <CardHeader>
              <CardTitle className="text-sm flex items-center justify-between">
                Ativos por ciclo de vida
                <ArrowRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-all" />
              </CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              {pieData.length === 0
                ? <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem ativos cadastrados.</div>
                : <Suspense fallback={<ChartFallback />}><CicloVidaPieChart data={pieData} /></Suspense>}
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ELP */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Effective License Position (ELP)</CardTitle>
            <Button asChild size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground">
              <Link to="/licencas">Ver licenças <ArrowRight className="h-3 w-3" /></Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead><TableHead>Categoria</TableHead><TableHead>Fabricante</TableHead>
                  <TableHead className="text-right">Compradas</TableHead><TableHead className="text-right">Alocadas</TableHead>
                  <TableHead className="text-right">Saldo</TableHead><TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-6">Carregando…</TableCell></TableRow>
                  : (data?.elp ?? []).length === 0
                  ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-6">Nenhum produto cadastrado.</TableCell></TableRow>
                  : data!.elp.map((r) => {
                      const s = statusStyle(r.status_compliance);
                      return (
                        <TableRow key={r.produto_id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => { window.location.href = "/licencas"; }}>
                          <TableCell className="font-medium">{r.nome_oficial}</TableCell>
                          <TableCell>{r.categoria}</TableCell>
                          <TableCell>{r.fabricante ?? "—"}</TableCell>
                          <TableCell className="text-right">{r.licencas_compradas}</TableCell>
                          <TableCell className="text-right">{r.licencas_alocadas}</TableCell>
                          <TableCell className="text-right font-mono">{r.saldo}</TableCell>
                          <TableCell>
                            <Badge className={s.cls} variant="outline">
                              {r.status_compliance === "deficit" && <XCircle className="h-3 w-3 mr-1" />}
                              {r.status_compliance === "ok" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                              {r.status_compliance === "ocioso" && <Snowflake className="h-3 w-3 mr-1" />}
                              {s.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
