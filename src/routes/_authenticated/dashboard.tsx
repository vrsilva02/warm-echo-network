import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
      { title: "Dashboard — ITAM/SAM" },
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
      const [elp, ativos, vencendo, ociosas] = await Promise.all([
        supabase.from("vw_elp").select("*"),
        supabase.from("ativos").select("status_ciclo_vida"),
        supabase.from("vw_contratos_vencendo").select("id,dias_para_vencer,urgencia"),
        supabase.from("vw_licencas_ociosas").select("licenca_id"),
      ]);
      return {
        elp: (elp.data ?? []) as ElpRow[],
        ativos: ativos.data ?? [],
        contratosVencendo30: (vencendo.data ?? []).filter((r: any) => r.dias_para_vencer <= 30).length,
        licencasOciosas: ociosas.data?.length ?? 0,
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
        <KpiCard title="Licenças Windows" value={totais.Windows ?? 0} icon={<KeySquare className="h-4 w-4" />} />
        <KpiCard title="Licenças Office" value={totais.Office ?? 0} icon={<KeySquare className="h-4 w-4" />} />
        <KpiCard title="Licenças EDR" value={totais.EDR ?? 0} icon={<KeySquare className="h-4 w-4" />} />
        <KpiCard
          title="Compliance geral"
          value={`${compliance}%`}
          icon={compliance >= 90 ? <CheckCircle2 className="h-4 w-4 text-[color:var(--success)]" /> : <AlertTriangle className="h-4 w-4 text-[color:var(--warning)]" />}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <KpiCard
          title="Contratos vencendo em 30 dias"
          value={data?.contratosVencendo30 ?? 0}
          icon={<FileWarning className="h-4 w-4 text-[color:var(--warning)]" />}
        />
        <KpiCard
          title="Licenças ociosas (>90d)"
          value={data?.licencasOciosas ?? 0}
          icon={<Snowflake className="h-4 w-4 text-primary" />}
        />
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

function KpiCard({ title, value, icon }: { title: string; value: number | string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
