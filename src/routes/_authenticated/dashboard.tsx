import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { lazy, Suspense } from "react";

const ElpBarChart = lazy(() => import("@/components/dashboard-charts").then((m) => ({ default: m.ElpBarChart })));
const CicloVidaPieChart = lazy(() => import("@/components/dashboard-charts").then((m) => ({ default: m.CicloVidaPieChart })));
const TcoCentroBarChart = lazy(() => import("@/components/dashboard-charts").then((m) => ({ default: m.TcoCentroBarChart })));

function ChartFallback() {
  return <div className="h-full w-full animate-pulse rounded-md bg-muted/50" />;
}
import { AlertTriangle, CheckCircle2, XCircle, KeySquare, FileWarning, Snowflake, ShieldAlert, Coins, Settings2, Wrench, Package, Building2, Boxes } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@tanstack/react-router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";

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

function useDashboardData() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [elp, ativos, vencendo, indicadores, ocioseFin, risco, custoOc, gapEdr, tco, osAbertas, osAguardando, pecasRep, defRec] = await Promise.all([
        supabase.from("vw_elp").select("*"),
        supabase.from("ativos").select("id, status_ciclo_vida, centro_custo_id, centros_custo(nome)"),
        supabase.from("vw_contratos_vencendo").select("id,dias_para_vencer,urgencia"),
        supabase.from("vw_licencas_indicadores").select("*"),
        supabase.from("vw_ociosidade_financeira").select("*"),
        supabase.rpc("fn_risco_compliance", { _categoria: null as unknown as string }),
        supabase.from("vw_custo_ociosas").select("*"),
        supabase.from("vw_gap_edr").select("ativo_id"),
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
        licencasOciosas: (indicadores.data ?? []).reduce((acc, curr) => acc + (curr.disponiveis ?? 0), 0),
        ocioseFin: (ocioseFin.data ?? []) as Array<{ produto_id: string; nome_oficial: string; categoria: string; licencas_ociosas: number; valor_ocioso: number }>,
        risco: (risco.data ?? []) as Array<{ categoria: string; deficit_pct: number; criticidade_media: number; score: number }>,
        custoOciosasMensal: (custoOc.data ?? []).reduce((a: number, r: any) => a + Number(r.custo_mensal_desperdicado ?? 0), 0),
        gapEdrCount: gapEdr.data?.length ?? 0,
        tco: (tco.data ?? []) as Array<{ ativo_id: string; tco_anual_estimado: number | null }>,
        osAbertasCount: (osAbertas as any).count ?? 0,
        osAguardandoPecaCount: (osAguardando as any).count ?? 0,
        pecasReposicaoCount: (pecasRep.data ?? []).length,
        defeitoRecorrenteCount: (defRec.data ?? []).length,
      };
    },
  });
}


function useAtivosPorCliente() {
  return useQuery({
    queryKey: ["dashboard", "ativos-por-cliente"],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const [totalRes, clientesRes, semClienteRes] = await Promise.all([
        supabase.from("ativos").select("id", { count: "exact", head: true }),
        supabase.from("clientes").select("id,nome").order("nome"),
        supabase.from("ativos").select("id", { count: "exact", head: true }).is("cliente_id", null),
      ]);
      const clientes = (clientesRes.data ?? []) as Array<{ id: string; nome: string }>;
      const counts = await Promise.all(
        clientes.map(async (c) => {
          const { count } = await supabase
            .from("ativos")
            .select("id", { count: "exact", head: true })
            .eq("cliente_id", c.id);
          return { id: c.id, nome: c.nome, total: count ?? 0 };
        }),
      );
      return {
        total: totalRes.count ?? 0,
        semCliente: semClienteRes.count ?? 0,
        porCliente: counts.sort((a, b) => b.total - a.total),
      };
    },
  });
}

function AtivosPorClienteCard() {
  const { data, isLoading } = useAtivosPorCliente();
  const total = data?.total ?? 0;
  const linhas = [
    ...(data?.porCliente ?? []),
    ...((data?.semCliente ?? 0) > 0 ? [{ id: "__sem__", nome: "Sem cliente", total: data!.semCliente }] : []),
  ];
  return (
    <Card className="lg:col-span-3">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" /> Ativos por cliente
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : linhas.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Nenhum ativo cadastrado.</div>
        ) : (
          <div className="space-y-2">
            {linhas.map((c) => {
              const pct = total > 0 ? Math.round((c.total / total) * 100) : 0;
              return (
                <div key={c.id} className="text-xs">
                  <div className="mb-1 flex justify-between gap-2">
                    <span className="truncate font-medium">{c.nome}</span>
                    <span className="font-mono tabular-nums text-muted-foreground">{c.total} · {pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function statusStyle(s: string) {
  if (s === "ok") return { label: "OK", cls: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30" };
  if (s === "ocioso") return { label: "Ocioso", cls: "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30" };
  return { label: "Déficit", cls: "bg-destructive/15 text-destructive border-destructive/30" };
}

function DashboardPage() {
  const { data, isLoading } = useDashboardData();
  const { data: ativosCliente } = useAtivosPorCliente();

  useRealtimeInvalidate({
    channel: "dashboard-live",
    table: "alocacoes",
    queryKeys: [["dashboard"]],
  });
  useRealtimeInvalidate({
    channel: "dashboard-ativos-live",
    table: "ativos",
    queryKeys: [["dashboard"]],
  });
  useRealtimeInvalidate({
    channel: "dashboard-licencas-live",
    table: "licencas",
    queryKeys: [["dashboard"]],
  });

  const totais = { Windows: 0, Office: 0, EDR: 0 } as Record<string, number>;
  let compradas = 0;
  let alocadas = 0;
  (data?.elp ?? []).forEach((r) => {
    totais[r.categoria] = (totais[r.categoria] ?? 0) + Number(r.licencas_compradas);
    compradas += Number(r.licencas_compradas);
    alocadas += Number(r.licencas_alocadas);
  });
  const compliance = compradas > 0 ? Math.min(100, Math.round(((compradas - Math.max(0, alocadas - compradas)) / compradas) * 100)) : 100;

  const chartElp = (data?.elp ?? []).slice(0, 10).map((r) => ({
    nome: r.nome_oficial.length > 18 ? r.nome_oficial.slice(0, 18) + "…" : r.nome_oficial,
    Compradas: Number(r.licencas_compradas),
    Alocadas: Number(r.licencas_alocadas),
  }));

  const ativosCount: Record<string, number> = {};
  (data?.ativos ?? []).forEach((a: any) => {
    ativosCount[a.status_ciclo_vida] = (ativosCount[a.status_ciclo_vida] ?? 0) + 1;
  });
  const pieData = Object.entries(ativosCount).map(([name, value]) => ({ name, value }));

  return (
    <>
      <PageHeader title="Dashboard" description="Posição efetiva de licenças, contratos e ativos em tempo real." />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-5 mb-6">
        <KpiCard title="Total de ativos" value={ativosCliente?.total ?? 0} icon={<Boxes className="h-4 w-4" />} hint="Quantidade total de ativos cadastrados no sistema." />
        <AtivosPorClienteCard />
      </div>


      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mb-6">
        <KpiCard title="Licenças Windows" value={totais.Windows ?? 0} icon={<KeySquare className="h-4 w-4" />} hint="Soma de seats comprados em contratos ativos para produtos da categoria Windows." />
        <KpiCard title="Licenças Office" value={totais.Office ?? 0} icon={<KeySquare className="h-4 w-4" />} hint="Soma de seats comprados em contratos ativos para produtos da categoria Office." />
        <KpiCard title="Licenças EDR" value={totais.EDR ?? 0} icon={<KeySquare className="h-4 w-4" />} hint="Soma de seats comprados em contratos ativos para produtos de EDR/segurança." />
        <KpiCard
          title="Compliance geral"
          value={`${compliance}%`}
          icon={compliance >= 90 ? <CheckCircle2 className="h-4 w-4 text-[color:var(--success)]" /> : <AlertTriangle className="h-4 w-4 text-[color:var(--warning)]" />}
          hint="Percentual de seats dentro do direito contratado. Valores abaixo de 100% indicam alocações acima do comprado (over-deployment)."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mb-6">
        <KpiCard
          title="Contratos vencendo em 30 dias"
          value={data?.contratosVencendo30 ?? 0}
          icon={<FileWarning className="h-4 w-4 text-[color:var(--warning)]" />}
          hint="Contratos com data de término nos próximos 30 dias."
        />
        <KpiCard
          title="Licenças ociosas"
          value={data?.licencasOciosas ?? 0}
          icon={<Snowflake className="h-4 w-4 text-primary" />}
          hint="Quantidade de licenças em estoque não atribuídas a nenhum ativo (Disponíveis)."
        />
        <KpiCard
          title="Valor financeiro ocioso"
          value={`R$ ${(data?.ocioseFin ?? []).reduce((a, x) => a + Number(x.valor_ocioso ?? 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          icon={<Coins className="h-4 w-4 text-[color:var(--warning)]" />}
          hint="Soma do valor de aquisição das licenças em estoque (disponíveis)."
        />
        <KpiCard
          title="Score máx. de risco"
          value={Math.round(Math.max(0, ...(data?.risco ?? []).map((r) => Number(r.score ?? 0))))}
          icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
          hint="Maior score de risco de compliance entre categorias (0–100): déficit(%) × criticidade média do fabricante ÷ 5."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mb-6">
        <KpiCard title="OS abertas" value={data?.osAbertasCount ?? 0} icon={<Wrench className="h-4 w-4 text-[color:var(--info)]" />} hint="Ordens de serviço com status aberta ou em andamento." />
        <KpiCard title="OS aguardando peça" value={data?.osAguardandoPecaCount ?? 0} icon={<Wrench className="h-4 w-4 text-[color:var(--warning)]" />} hint="Reparos pausados aguardando reposição de peça no estoque." />
        <KpiCard title="Peças em reposição" value={data?.pecasReposicaoCount ?? 0} icon={<Package className="h-4 w-4 text-[color:var(--warning)]" />} hint="Peças cujo saldo está abaixo do estoque mínimo." />
        <KpiCard title="Ativos com defeito recorrente" value={data?.defeitoRecorrenteCount ?? 0} icon={<AlertTriangle className="h-4 w-4 text-destructive" />} hint="Ativos com 3 ou mais OS nos últimos 6 meses — considere substituição." />
      </div>


      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5 mb-6">
        <CustoOciosasCard valor={data?.custoOciosasMensal ?? 0} />
        <GapEdrCard count={data?.gapEdrCount ?? 0} />
        <TcoPorCentroCard tco={data?.tco ?? []} ativos={(data?.ativos ?? []) as any[]} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 mb-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Top 5 produtos por valor ocioso</CardTitle></CardHeader>
          <CardContent>
            {(data?.ocioseFin ?? []).filter((x) => Number(x.valor_ocioso) > 0).length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">Sem ociosidade financeira registrada.</div>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead>Categoria</TableHead><TableHead className="text-right">Ociosas</TableHead><TableHead className="text-right">Valor (R$)</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(data?.ocioseFin ?? [])
                    .filter((x) => Number(x.valor_ocioso) > 0)
                    .sort((a, b) => Number(b.valor_ocioso) - Number(a.valor_ocioso))
                    .slice(0, 5)
                    .map((x) => (
                      <TableRow key={x.produto_id}>
                        <TableCell className="font-medium">{x.nome_oficial}</TableCell>
                        <TableCell>{x.categoria}</TableCell>
                        <TableCell className="text-right font-mono">{x.licencas_ociosas}</TableCell>
                        <TableCell className="text-right font-mono">{Number(x.valor_ocioso).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Risco de compliance por categoria</CardTitle></CardHeader>
          <CardContent>
            {(data?.risco ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">Sem dados suficientes para calcular risco.</div>
            ) : (
              <div className="space-y-2">
                {(data?.risco ?? [])
                  .sort((a, b) => Number(b.score) - Number(a.score))
                  .map((r) => {
                    const score = Number(r.score ?? 0);
                    const tone = score >= 60 ? "bg-destructive" : score >= 30 ? "bg-[color:var(--warning)]" : "bg-[color:var(--success)]";
                    return (
                      <div key={r.categoria} className="text-xs">
                        <div className="flex justify-between mb-1">
                          <span className="font-medium">{r.categoria}</span>
                          <span className="font-mono tabular-nums">
                            {score.toFixed(0)} · déficit {Number(r.deficit_pct ?? 0).toFixed(0)}% · crit {Number(r.criticidade_media ?? 0).toFixed(1)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full ${tone}`} style={{ width: `${Math.min(100, score)}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Compradas × Alocadas por produto</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {chartElp.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Cadastre produtos e licenças para ver o gráfico.
              </div>
            ) : (
              <Suspense fallback={<ChartFallback />}>
                <ElpBarChart data={chartElp} />
              </Suspense>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ativos por ciclo de vida</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {pieData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Sem ativos cadastrados.
              </div>
            ) : (
              <Suspense fallback={<ChartFallback />}>
                <CicloVidaPieChart data={pieData} />
              </Suspense>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Effective License Position (ELP)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Fabricante</TableHead>
                  <TableHead className="text-right">Compradas</TableHead>
                  <TableHead className="text-right">Alocadas</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-6">
                      Carregando…
                    </TableCell>
                  </TableRow>
                ) : (data?.elp ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-6">
                      Nenhum produto cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  data!.elp.map((r) => {
                    const s = statusStyle(r.status_compliance);
                    return (
                      <TableRow key={r.produto_id}>
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
                            {r.status_compliance === "ocioso" && <AlertTriangle className="h-3 w-3 mr-1" />}
                            {s.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function KpiCard({ title, value, icon, hint }: { title: string; value: number | string; icon: React.ReactNode; hint?: string }) {
  return (
    <Card className="elevate min-w-0">
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
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground">
          {icon}
        </span>
      </CardHeader>
      <CardContent>
        <div className="metric text-[1.75rem] leading-none">{value}</div>
      </CardContent>
    </Card>
  );
}

const OCIOSAS_KEY = "gestorait.ociosas.limit";

function brl(v: number) {
  return `R$ ${Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function CustoOciosasCard({ valor }: { valor: number }) {
  const [limit, setLimit] = useState<number>(5000);
  useEffect(() => {
    const v = Number(localStorage.getItem(OCIOSAS_KEY) ?? "5000");
    if (!Number.isNaN(v)) setLimit(v);
  }, []);
  function saveLimit(v: number) { setLimit(v); localStorage.setItem(OCIOSAS_KEY, String(v)); }
  const excede = valor > limit;
  const tone = excede ? "text-destructive" : "text-foreground";
  return (
    <Card className={excede ? "border-destructive/40" : ""}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
          <Snowflake className="h-3.5 w-3.5" /> Custo mensal em licenças ociosas
        </CardTitle>
        <Popover>
          <PopoverTrigger asChild>
            <Button size="icon" variant="ghost" className="h-6 w-6" title="Definir limite">
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
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-semibold tabular-nums ${tone}`}>{brl(valor)}</div>
        <div className="text-[11px] text-muted-foreground mt-1">Limite: {brl(limit)}{excede && " · acima do limite"}</div>
      </CardContent>
    </Card>
  );
}

function GapEdrCard({ count }: { count: number }) {
  const tone = count > 0 ? "text-destructive" : "text-[color:var(--success)]";
  return (
    <Card className={count > 0 ? "border-destructive/40" : ""}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
          <ShieldAlert className="h-3.5 w-3.5" /> Ativos sem cobertura EDR
        </CardTitle>
        <Button asChild variant="ghost" size="sm" className="h-6 text-xs">
          <Link to="/alertas" search={{ tipo: "edr" } as any}>Ver</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-semibold tabular-nums ${tone}`}>{count}</div>
        <div className="text-[11px] text-muted-foreground mt-1">
          {count === 0 ? "Cobertura total" : "Ativos em uso sem licença EDR vinculada"}
        </div>
      </CardContent>
    </Card>
  );
}

function TcoPorCentroCard({ tco, ativos }: { tco: Array<{ ativo_id: string; tco_anual_estimado: number | null }>; ativos: any[] }) {
  const map = new Map<string, number>();
  const nomes = new Map<string, string>();
  const byAtivo = new Map(tco.map((r) => [r.ativo_id, Number(r.tco_anual_estimado ?? 0)]));
  ativos.forEach((a) => {
    if (!a.centro_custo_id) return;
    const nome = a.centros_custo?.nome ?? "—";
    nomes.set(a.centro_custo_id, nome);
    map.set(a.centro_custo_id, (map.get(a.centro_custo_id) ?? 0) + (byAtivo.get(a.id) ?? 0));
  });
  const rows = Array.from(map.entries())
    .map(([id, v]) => ({ nome: nomes.get(id) ?? "—", valor: v }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
          <Coins className="h-3.5 w-3.5" /> TCO por centro de custo (top 5)
        </CardTitle>
      </CardHeader>
      <CardContent className="h-40 p-0 pl-2">
        {rows.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Sem centros vinculados.</div>
        ) : (
          <Suspense fallback={<ChartFallback />}>
            <TcoCentroBarChart rows={rows} formatValue={brl} />
          </Suspense>
        )}
      </CardContent>
    </Card>
  );
}
