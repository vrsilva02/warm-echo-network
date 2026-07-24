import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Download, FileText } from "lucide-react";
import { downloadCSV, downloadPDF } from "@/lib/export";
import { logAction } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/relatorios")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Relatórios — ITAM/SAM" },
      { name: "description", content: "Exportações CSV e PDF de ELP e contratos a vencer com filtros." },
    ],
  }),
});

const CATEGORIAS = ["Todas", "Windows", "Office", "EDR", "Outro"];

function Page() {
  return (
    <>
      <PageHeader title="Relatórios" description="Exporte ELP e contratos a vencer em CSV ou PDF com filtros por período e categoria." />
      <div className="grid gap-6">
        <ElpReport />
        <ContratosReport />
      </div>
    </>
  );
}

function ElpReport() {
  const [categoria, setCategoria] = useState("Todas");
  const [status, setStatus] = useState("todos");

  const { data, isLoading } = useQuery({
    queryKey: ["rel-elp"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vw_elp").select("*").order("nome_oficial");
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    return (data ?? []).filter((r: any) => {
      if (categoria !== "Todas" && r.categoria !== categoria) return false;
      if (status !== "todos" && r.status_compliance !== status) return false;
      return true;
    });
  }, [data, categoria, status]);

  const columns = ["Produto", "Fabricante", "Categoria", "Compradas", "Alocadas", "Saldo", "Status"];
  const asArray = (r: any) => [r.nome_oficial, r.fabricante ?? "—", r.categoria, r.licencas_compradas, r.licencas_alocadas, r.saldo, r.status_compliance];
  const filterLabel = `Categoria: ${categoria} · Status: ${status}`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
        <CardTitle className="text-base">Effective License Position (ELP)</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={rows.length === 0} onClick={() => {
            downloadCSV(`elp-${new Date().toISOString().slice(0, 10)}.csv`, columns, rows.map(asArray));
            void logAction("EXPORT", "vw_elp", { formato: "csv", total: rows.length, filtros: { categoria, status } });
          }}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button size="sm" disabled={rows.length === 0} onClick={() => {
            downloadPDF({
              filename: `elp-${new Date().toISOString().slice(0, 10)}.pdf`,
              title: "Effective License Position",
              subtitle: filterLabel,
              columns,
              rows: rows.map(asArray),
            });
            void logAction("EXPORT", "vw_elp", { formato: "pdf", total: rows.length, filtros: { categoria, status } });
          }}>
            <FileText className="h-4 w-4" /> PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
          <div>
            <Label>Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status de compliance</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ok">OK</SelectItem>
                <SelectItem value="ocioso">Ocioso</SelectItem>
                <SelectItem value="deficit">Déficit</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{isLoading ? "Carregando…" : `${rows.length} produto(s) filtrado(s).`}</p>
        <DataTable
          columns={columns}
          empty={isLoading ? "Carregando…" : "Nenhum registro com os filtros atuais."}
          rows={rows.map((r: any) => [
            <span key="n" className="font-medium">{r.nome_oficial}</span>,
            r.fabricante ?? "—",
            r.categoria,
            <span key="c" className="tabular-nums">{r.licencas_compradas}</span>,
            <span key="a" className="tabular-nums">{r.licencas_alocadas}</span>,
            <span key="s" className="tabular-nums font-mono">{r.saldo}</span>,
            <StatusBadge key="st" status={r.status_compliance} />,
          ])}
        />
      </CardContent>
    </Card>
  );
}

function ContratosReport() {
  const hoje = new Date().toISOString().slice(0, 10);
  const em90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  const [inicio, setInicio] = useState(hoje);
  const [fim, setFim] = useState(em90);
  const [tipo, setTipo] = useState("todos");

  const { data, isLoading } = useQuery({
    queryKey: ["rel-contratos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vw_contratos_vencendo").select("*").order("data_fim");
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    return (data ?? []).filter((r: any) => {
      if (!r.data_fim) return false;
      if (r.data_fim < inicio || r.data_fim > fim) return false;
      if (tipo !== "todos" && r.tipo_contrato !== tipo) return false;
      return true;
    });
  }, [data, inicio, fim, tipo]);

  const columns = ["Fornecedor", "Nº Contrato", "Tipo", "Início", "Vencimento", "Dias", "Seats", "Valor total"];
  const asArray = (r: any) => [r.fornecedor, r.numero_contrato ?? "—", r.tipo_contrato ?? "—", r.data_inicio, r.data_fim, r.dias_para_vencer, r.quantidade_seats, r.valor_total ?? ""];
  const filterLabel = `Vencimento entre ${inicio} e ${fim} · Tipo: ${tipo}`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
        <CardTitle className="text-base">Contratos a vencer</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={rows.length === 0} onClick={() => downloadCSV(`contratos-${hoje}.csv`, columns, rows.map(asArray))}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button size="sm" disabled={rows.length === 0} onClick={() => downloadPDF({
            filename: `contratos-${hoje}.pdf`,
            title: "Contratos a vencer",
            subtitle: filterLabel,
            columns,
            rows: rows.map(asArray),
          })}>
            <FileText className="h-4 w-4" /> PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
          <div>
            <Label>Vencimento de</Label>
            <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div>
            <Label>Até</Label>
            <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
          </div>
          <div>
            <Label>Tipo de contrato</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {["CSP", "EA", "NCE", "Open Value", "Perpetua", "Outro"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{isLoading ? "Carregando…" : `${rows.length} contrato(s) no período.`}</p>
        <DataTable
          columns={columns}
          empty={isLoading ? "Carregando…" : "Nenhum contrato no período selecionado."}
          rows={rows.map((r: any) => [
            <span key="f" className="font-medium">{r.fornecedor}</span>,
            r.numero_contrato ?? "—",
            r.tipo_contrato ?? "—",
            r.data_inicio,
            r.data_fim,
            <UrgenciaBadge key="u" dias={r.dias_para_vencer} />,
            r.quantidade_seats,
            r.valor_total != null ? Number(r.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—",
          ])}
        />
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ok: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
    ocioso: "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30",
    deficit: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return <Badge variant="outline" className={map[status] ?? ""}>{status}</Badge>;
}

function UrgenciaBadge({ dias }: { dias: number }) {
  const cls = dias < 0
    ? "bg-destructive/15 text-destructive border-destructive/30"
    : dias <= 30
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : dias <= 60
        ? "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30"
        : "bg-muted text-muted-foreground";
  return <Badge variant="outline" className={cls}>{dias}d</Badge>;
}
