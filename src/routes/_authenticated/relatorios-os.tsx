import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/combobox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadXLSX } from "@/lib/export";
import { Download, FileBarChart } from "lucide-react";

export const Route = createFileRoute("/_authenticated/relatorios-os")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Relatórios de OS — GestoraIT" },
      { name: "description", content: "Filtre ordens de serviço por período, ativo, técnico e status e exporte em XLSX." },
      { property: "og:title", content: "Relatórios de OS — GestoraIT" },
      { property: "og:description", content: "Análise de OS com filtros e exportação." },
    ],
  }),
});

type OSRow = {
  id: string; numero: number; status: string; prioridade: string;
  descricao_defeito: string;
  data_abertura: string; data_conclusao: string | null;
  tecnico_id: string | null;
  ativo_id: string;
  ativos?: { hostname: string; setor: string | null; tipo: string } | null;
  profiles?: { nome: string | null; email: string | null } | null;
};

const STATUS_OPTS = [
  { v: "todos", l: "Todos" },
  { v: "aberta", l: "Aberta" },
  { v: "em_andamento", l: "Em andamento" },
  { v: "aguardando_peca", l: "Aguardando peça" },
  { v: "concluida", l: "Concluída" },
  { v: "cancelada", l: "Cancelada" },
];

function Page() {
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const [de, setDe] = useState(inicioMes.toISOString().slice(0, 10));
  const [ate, setAte] = useState(hoje.toISOString().slice(0, 10));
  const [status, setStatus] = useState("todos");
  const [ativoId, setAtivoId] = useState<string | null>(null);
  const [tecnicoId, setTecnicoId] = useState<string | null>(null);

  const { data: ativos } = useQuery({
    queryKey: ["opt-ativos"],
    queryFn: async () => ((await (supabase as any).from("ativos").select("id, hostname").order("hostname")).data ?? []) as Array<{ id: string; hostname: string }>,
  });
  const { data: tecnicos } = useQuery({
    queryKey: ["opt-tecnicos"],
    queryFn: async () => {
      const { data: ur } = await (supabase as any).from("user_roles").select("user_id").in("role", ["tecnico", "gestor_ti", "admin"]);
      const ids = Array.from(new Set((ur ?? []).map((r: any) => r.user_id).filter(Boolean)));
      if (ids.length === 0) return [];
      const { data } = await (supabase as any).from("profiles").select("id, nome, email").in("id", ids).order("nome");
      return (data ?? []) as Array<{ id: string; nome: string | null; email: string | null }>;
    },
  });

  const { data: rows } = useQuery({
    queryKey: ["rel-os", de, ate, status, ativoId, tecnicoId],
    queryFn: async () => {
      let q = (supabase as any).from("ordens_servico")
        .select("id, numero, status, prioridade, descricao_defeito, data_abertura, data_conclusao, tecnico_id, ativo_id, ativos(hostname, setor, tipo), profiles:tecnico_id(nome, email)")
        .gte("data_abertura", `${de}T00:00:00`)
        .lte("data_abertura", `${ate}T23:59:59`)
        .order("data_abertura", { ascending: false })
        .limit(1000);
      if (status !== "todos") q = q.eq("status", status);
      if (ativoId) q = q.eq("ativo_id", ativoId);
      if (tecnicoId) q = q.eq("tecnico_id", tecnicoId);
      const { data } = await q;
      return (data ?? []) as OSRow[];
    },
  });

  const kpis = useMemo(() => {
    const r = rows ?? [];
    const total = r.length;
    const abertas = r.filter((x) => !["concluida", "cancelada"].includes(x.status)).length;
    const concluidas = r.filter((x) => x.status === "concluida").length;
    const tmr = r
      .filter((x) => x.status === "concluida" && x.data_conclusao)
      .map((x) => (new Date(x.data_conclusao!).getTime() - new Date(x.data_abertura).getTime()) / 3600000);
    const media = tmr.length ? tmr.reduce((a, b) => a + b, 0) / tmr.length : 0;
    return { total, abertas, concluidas, tmrH: media };
  }, [rows]);

  function exportar() {
    const cols = ["OS", "Ativo", "Setor", "Prioridade", "Status", "Técnico", "Abertura", "Conclusão", "Duração (h)", "Defeito"];
    const body = (rows ?? []).map((r) => {
      const dur = r.data_conclusao
        ? ((new Date(r.data_conclusao).getTime() - new Date(r.data_abertura).getTime()) / 3600000).toFixed(2)
        : "";
      return [
        r.numero,
        r.ativos?.hostname ?? "",
        r.ativos?.setor ?? "",
        r.prioridade,
        r.status,
        r.profiles?.nome ?? r.profiles?.email ?? "",
        new Date(r.data_abertura).toLocaleString("pt-BR"),
        r.data_conclusao ? new Date(r.data_conclusao).toLocaleString("pt-BR") : "",
        dur,
        r.descricao_defeito,
      ];
    });
    downloadXLSX(`ordens-servico_${de}_${ate}.xlsx`, cols, body);
  }

  const ativoOpts = (ativos ?? []).map((a) => ({ value: a.id, label: a.hostname }));
  const tecnicoOpts = (tecnicos ?? []).map((t) => ({ value: t.id, label: t.nome ?? t.email ?? t.id }));

  return (
    <>
      <PageHeader
        title="Relatórios de OS"
        description="Ordens de serviço por período, ativo, técnico e status."
        actions={<Button onClick={exportar} disabled={!rows?.length}><Download className="h-4 w-4 mr-2" />Exportar XLSX</Button>}
      />

      <Card className="mb-4">
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><FileBarChart className="h-4 w-4" />Filtros</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          <div><Label>De</Label><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
          <div><Label>Até</Label><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS_OPTS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ativo</Label>
            <Combobox value={ativoId} onChange={setAtivoId} options={ativoOpts} placeholder="Todos" searchPlaceholder="Buscar ativo…" />
          </div>
          <div>
            <Label>Técnico</Label>
            <Combobox value={tecnicoId} onChange={setTecnicoId} options={tecnicoOpts} placeholder="Todos" searchPlaceholder="Buscar técnico…" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Kpi label="OS no período" value={kpis.total} />
        <Kpi label="Em aberto" value={kpis.abertas} />
        <Kpi label="Concluídas" value={kpis.concluidas} />
        <Kpi label="Tempo médio de reparo" value={`${kpis.tmrH.toFixed(1)} h`} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Resultados ({rows?.length ?? 0})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>OS</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Técnico</TableHead>
                <TableHead>Abertura</TableHead>
                <TableHead>Conclusão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rows ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Nenhuma OS no período.</TableCell></TableRow>
              ) : rows!.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link to="/ordens-servico/$id" params={{ id: r.id }} className="font-medium hover:text-primary tabular-nums">#{r.numero}</Link>
                  </TableCell>
                  <TableCell>{r.ativos?.hostname ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline">{r.prioridade}</Badge></TableCell>
                  <TableCell><Badge>{r.status}</Badge></TableCell>
                  <TableCell className="text-sm">{r.profiles?.nome ?? r.profiles?.email ?? "—"}</TableCell>
                  <TableCell className="text-xs tabular-nums">{new Date(r.data_abertura).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-xs tabular-nums">{r.data_conclusao ? new Date(r.data_conclusao).toLocaleString("pt-BR") : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
