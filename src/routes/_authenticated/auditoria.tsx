import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Eye, FileText } from "lucide-react";
import { downloadCSV, downloadPDF } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/auditoria")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Auditoria — ITAM/SAM" },
      { name: "description", content: "Log imutável e detalhado das ações no sistema, com filtros e exportação." },
    ],
  }),
});

const TABELAS = ["ativos", "usuarios", "licencas", "contratos", "alocacoes", "produtos_catalogo", "fabricantes"];
const ACOES = ["INSERT", "UPDATE", "DELETE"];

type LogRow = {
  id: string;
  created_at: string;
  acao: string;
  tabela_afetada: string;
  registro_id: string | null;
  usuario_sistema: string | null;
  valor_anterior: any;
  valor_novo: any;
};

function acaoBadge(acao: string) {
  const map: Record<string, string> = {
    INSERT: "bg-success/15 text-success border-success/30",
    UPDATE: "bg-primary/15 text-primary border-primary/30",
    DELETE: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return <Badge variant="outline" className={map[acao] ?? ""}>{acao}</Badge>;
}

function DiffView({ before, after }: { before: any; after: any }) {
  const keys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])).sort();
  const changed = (k: string) => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]);
  const fmt = (v: any) => (v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

  if (!before && after) {
    return (
      <div className="space-y-1 text-sm">
        {keys.map((k) => (
          <div key={k} className="grid grid-cols-[160px_1fr] gap-2 border-b border-border/40 py-1">
            <span className="text-muted-foreground font-mono text-xs">{k}</span>
            <span className="text-success">{fmt(after?.[k])}</span>
          </div>
        ))}
      </div>
    );
  }
  if (before && !after) {
    return (
      <div className="space-y-1 text-sm">
        {keys.map((k) => (
          <div key={k} className="grid grid-cols-[160px_1fr] gap-2 border-b border-border/40 py-1">
            <span className="text-muted-foreground font-mono text-xs">{k}</span>
            <span className="text-destructive line-through">{fmt(before?.[k])}</span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-1 text-sm">
      {keys.map((k) => (
        <div
          key={k}
          className={`grid grid-cols-[160px_1fr_1fr] gap-2 border-b border-border/40 py-1 ${
            changed(k) ? "bg-warning/5" : ""
          }`}
        >
          <span className="text-muted-foreground font-mono text-xs">{k}</span>
          <span className={changed(k) ? "text-destructive line-through" : ""}>{fmt(before?.[k])}</span>
          <span className={changed(k) ? "text-success" : ""}>{fmt(after?.[k])}</span>
        </div>
      ))}
    </div>
  );
}

function Page() {
  const [tabela, setTabela] = useState<string>("todas");
  const [acao, setAcao] = useState<string>("todas");
  const [usuario, setUsuario] = useState("");
  const [desde, setDesde] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [ate, setAte] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [detail, setDetail] = useState<LogRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["auditoria", tabela, acao, usuario, desde, ate],
    queryFn: async () => {
      let q = supabase
        .from("auditoria_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (tabela !== "todas") q = q.eq("tabela_afetada", tabela);
      if (acao !== "todas") q = q.eq("acao", acao);
      if (usuario.trim()) q = q.ilike("usuario_sistema", `%${usuario.trim()}%`);
      if (desde) q = q.gte("created_at", `${desde}T00:00:00`);
      if (ate) q = q.lte("created_at", `${ate}T23:59:59`);
      const { data } = await q;
      return (data ?? []) as LogRow[];
    },
  });

  const kpis = useMemo(() => {
    const rows = data ?? [];
    return {
      total: rows.length,
      inserts: rows.filter((r) => r.acao === "INSERT").length,
      updates: rows.filter((r) => r.acao === "UPDATE").length,
      deletes: rows.filter((r) => r.acao === "DELETE").length,
    };
  }, [data]);

  const exportRows = () =>
    (data ?? []).map((r) => [
      new Date(r.created_at).toLocaleString("pt-BR"),
      r.acao,
      r.tabela_afetada,
      r.registro_id ?? "",
      r.usuario_sistema ?? "",
    ]);
  const cols = ["Quando", "Ação", "Tabela", "Registro", "Usuário"];

  return (
    <>
      <PageHeader
        title="Log de Auditoria"
        description="Rastreamento imutável de todas as operações. Filtre, inspecione o diff e exporte para evidências."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KPI label="Eventos" value={kpis.total} />
        <KPI label="Criações" value={kpis.inserts} tone="success" />
        <KPI label="Alterações" value={kpis.updates} tone="primary" />
        <KPI label="Exclusões" value={kpis.deletes} tone="destructive" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-4">
        <Select value={tabela} onValueChange={setTabela}>
          <SelectTrigger><SelectValue placeholder="Tabela" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as tabelas</SelectItem>
            {TABELAS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={acao} onValueChange={setAcao}>
          <SelectTrigger><SelectValue placeholder="Ação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as ações</SelectItem>
            {ACOES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input placeholder="Usuário (email)" value={usuario} onChange={(e) => setUsuario(e.target.value)} />
        <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadCSV(`auditoria_${desde}_${ate}.csv`, cols, exportRows())}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() =>
            downloadPDF({
              filename: `auditoria_${desde}_${ate}.pdf`,
              title: "Log de Auditoria",
              subtitle: `Período: ${desde} a ${ate}${tabela !== "todas" ? ` • Tabela: ${tabela}` : ""}${acao !== "todas" ? ` • Ação: ${acao}` : ""}`,
              columns: cols,
              rows: exportRows(),
            })
          }>
            <FileText className="h-4 w-4 mr-1" /> PDF
          </Button>
        </div>
      </div>

      <DataTable
        columns={["Quando", "Ação", "Tabela", "Registro", "Usuário", ""]}
        empty={isLoading ? "Carregando…" : "Nenhum evento no período/filtro."}
        rows={(data ?? []).map((r) => [
          <span key="w" className="font-mono text-xs whitespace-nowrap">
            {new Date(r.created_at).toLocaleString("pt-BR")}
          </span>,
          acaoBadge(r.acao),
          <span key="t" className="font-mono text-xs">{r.tabela_afetada}</span>,
          <span key="i" className="font-mono text-xs text-muted-foreground">
            {r.registro_id?.slice(0, 8) ?? "—"}
          </span>,
          <span key="u" className="text-xs">{r.usuario_sistema ?? "sistema"}</span>,
          <Button key="d" variant="ghost" size="sm" onClick={() => setDetail(r)}>
            <Eye className="h-4 w-4" />
          </Button>,
        ])}
      />

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detail && acaoBadge(detail.acao)}
              <span className="font-mono text-sm">{detail?.tabela_afetada}</span>
              <span className="text-xs text-muted-foreground font-normal">
                {detail && new Date(detail.created_at).toLocaleString("pt-BR")} • {detail?.usuario_sistema ?? "sistema"}
              </span>
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <ScrollArea className="max-h-[60vh] pr-3">
              {detail.acao === "UPDATE" && (
                <div className="grid grid-cols-[160px_1fr_1fr] gap-2 pb-2 text-xs text-muted-foreground border-b border-border/60 mb-2">
                  <span>Campo</span>
                  <span>Antes</span>
                  <span>Depois</span>
                </div>
              )}
              <DiffView before={detail.valor_anterior} after={detail.valor_novo} />
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function KPI({ label, value, tone }: { label: string; value: number; tone?: "success" | "primary" | "destructive" }) {
  const toneClass =
    tone === "success" ? "text-success"
    : tone === "destructive" ? "text-destructive"
    : tone === "primary" ? "text-primary"
    : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
