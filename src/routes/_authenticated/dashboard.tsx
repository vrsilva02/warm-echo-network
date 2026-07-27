import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { AlertTriangle, CheckCircle2, XCircle, KeySquare, FileWarning, Snowflake } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Dashboard — Gestorait" },
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
      const [elp, ativos, vencendo, ociosas, ocioseFin, risco] = await Promise.all([
        supabase.from("vw_elp").select("*"),
        supabase.from("ativos").select("status_ciclo_vida"),
        supabase.from("vw_contratos_vencendo").select("id,dias_para_vencer,urgencia"),
        supabase.from("vw_licencas_ociosas").select("licenca_id"),
        supabase.from("vw_ociosidade_financeira").select("*"),
        supabase.rpc("fn_risco_compliance", { _categoria: null as unknown as string }),
      ]);
      return {
        elp: (elp.data ?? []) as ElpRow[],
        ativos: ativos.data ?? [],
        contratosVencendo30: (vencendo.data ?? []).filter((r: any) => r.dias_para_vencer <= 30).length,
        licencasOciosas: ociosas.data?.length ?? 0,
        ocioseFin: (ocioseFin.data ?? []) as Array<{ produto_id: string; nome_oficial: string; categoria: string; licencas_ociosas: number; valor_ocioso: number }>,
        risco: (risco.data ?? []) as Array<{ categoria: string; deficit_pct: number; criticidade_media: number; score: number }>,
      };
    },
  });
}

const CHART_COLORS = ["hsl(215 85% 55%)", "hsl(148 65% 45%)", "hsl(35 90% 55%)", "hsl(270 60% 55%)", "hsl(0 70% 55%)"];

function statusStyle(s: string) {
  if (s === "ok") return { label: "OK", cls: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30" };
  if (s === "ocioso") return { label: "Ocioso", cls: "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30" };
  return { label: "Déficit", cls: "bg-destructive/15 text-destructive border-destructive/30" };
}

function DashboardPage() {
  const { data, isLoading } = useDashboardData();

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Contratos vencendo em 30 dias"
          value={data?.contratosVencendo30 ?? 0}
          icon={<FileWarning className="h-4 w-4 text-[color:var(--warning)]" />}
          hint="Contratos com data de término nos próximos 30 dias."
        />
        <KpiCard
          title="Licenças ociosas (>90d)"
          value={data?.licencasOciosas ?? 0}
          icon={<Snowflake className="h-4 w-4 text-primary" />}
          hint="Alocações ativas sem uso registrado há mais de 90 dias."
        />
        <KpiCard
          title="Valor financeiro ocioso"
          value={`R$ ${(data?.ocioseFin ?? []).reduce((a, x) => a + Number(x.valor_ocioso ?? 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          icon={<Snowflake className="h-4 w-4 text-[color:var(--warning)]" />}
          hint="Soma de custo_unitário × licenças ociosas por produto (janela >90d sem alocação)."
        />
        <KpiCard
          title="Score máx. de risco"
          value={Math.round(Math.max(0, ...(data?.risco ?? []).map((r) => Number(r.score ?? 0))))}
          icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
          hint="Maior score de risco de compliance entre categorias (0–100): déficit(%) × criticidade média do fabricante ÷ 5."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
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
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartElp}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="nome" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Compradas" fill="hsl(215 85% 55%)" />
                  <Bar dataKey="Alocadas" fill="hsl(148 65% 45%)" />
                </BarChart>
              </ResponsiveContainer>
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
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          {title}
          {hint && (
            <UITooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="Sobre este indicador" className="text-muted-foreground/60 hover:text-foreground">
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">{hint}</TooltipContent>
            </UITooltip>
          )}
        </CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
