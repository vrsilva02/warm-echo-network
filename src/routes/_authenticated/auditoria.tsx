import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { DiffView } from "@/components/diff-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Eye, FileText, History, Loader2 } from "lucide-react";
import { downloadCSV, downloadPDF } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/auditoria")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Auditoria — Gestorait" },
      { name: "description", content: "Log imutável e detalhado das ações no sistema, com filtros, timeline e exportação." },
    ],
  }),
});

const PAGE_SIZE = 50;
const TABELAS = ["ativos", "usuarios", "licencas", "contratos", "alocacoes", "produtos_catalogo", "fabricantes", "user_roles"];
const ACOES = ["INSERT", "UPDATE", "DELETE", "BULK_UPDATE", "BULK_DELETE", "EXPORT", "LOGIN"];

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
    BULK_UPDATE: "bg-primary/15 text-primary border-primary/30",
    BULK_DELETE: "bg-destructive/15 text-destructive border-destructive/30",
    EXPORT: "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30",
    LOGIN: "bg-muted text-muted-foreground",
  };
  return <Badge variant="outline" className={map[acao] ?? ""}>{acao.replace("_", " ")}</Badge>;
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

  // Ordenação consistente: created_at desc + id desc (desempate estável para
  // eventos no mesmo instante). Paginação por range() com pageParam numérico.
  const query = useInfiniteQuery({
    queryKey: ["auditoria", tabela, acao, usuario, desde, ate],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let q = supabase
        .from("auditoria_log")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to);
      if (tabela !== "todas") q = q.eq("tabela_afetada", tabela);
      if (acao !== "todas") q = q.eq("acao", acao);
      if (usuario.trim()) q = q.ilike("usuario_sistema", `%${usuario.trim()}%`);
      if (desde) q = q.gte("created_at", `${desde}T00:00:00`);
      if (ate) q = q.lte("created_at", `${ate}T23:59:59`);
      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as LogRow[], count: count ?? 0, page: pageParam };
    },
    getNextPageParam: (last) => {
      const loaded = (last.page + 1) * PAGE_SIZE;
      return loaded < last.count ? last.page + 1 : undefined;
    },
  });

  const rows = useMemo(() => query.data?.pages.flatMap((p) => p.rows) ?? [], [query.data]);
  const total = query.data?.pages[0]?.count ?? 0;

  // Auto-load on scroll near bottom.
  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && query.hasNextPage && !query.isFetchingNextPage) {
        query.fetchNextPage();
      }
    }, { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, [query]);

  const kpis = useMemo(
    () => ({
      total,
      carregados: rows.length,
      inserts: rows.filter((r) => r.acao === "INSERT").length,
      updates: rows.filter((r) => r.acao === "UPDATE").length,
      deletes: rows.filter((r) => r.acao === "DELETE").length,
    }),
    [rows, total],
  );

  const cols = ["Quando", "Ação", "Tabela", "Registro", "Usuário"];
  const exportRows = () =>
    rows.map((r) => [
      new Date(r.created_at).toLocaleString("pt-BR"),
      r.acao,
      r.tabela_afetada,
      r.registro_id ?? "",
      r.usuario_sistema ?? "",
    ]);

  return (
    <>
      <PageHeader
        title="Log de Auditoria"
        description="Rastreamento imutável de todas as operações. Filtre, inspecione o diff, abra a timeline e exporte para evidências."
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <KPI label="Total (filtro)" value={kpis.total} />
        <KPI label="Carregados" value={kpis.carregados} />
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
              subtitle: `Período: ${desde} a ${ate}${tabela !== "todas" ? ` • Tabela: ${tabela}` : ""}${acao !== "todas" ? ` • Ação: ${acao}` : ""} • ${rows.length} de ${total}`,
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
        empty={query.isLoading ? "Carregando…" : "Nenhum evento no período/filtro."}
        rows={rows.map((r) => [
          <span key="w" className="font-mono text-xs whitespace-nowrap">
            {new Date(r.created_at).toLocaleString("pt-BR")}
          </span>,
          acaoBadge(r.acao),
          <span key="t" className="font-mono text-xs">{r.tabela_afetada}</span>,
          <span key="i" className="font-mono text-xs text-muted-foreground">
            {r.registro_id?.slice(0, 8) ?? "—"}
          </span>,
          <span key="u" className="text-xs">{r.usuario_sistema ?? "sistema"}</span>,
          <div key="d" className="flex gap-1 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setDetail(r)} title="Ver diff">
              <Eye className="h-4 w-4" />
            </Button>
            {r.registro_id && (
              <Button variant="ghost" size="sm" asChild title="Timeline do registro">
                <Link to="/auditoria/$tabela/$id" params={{ tabela: r.tabela_afetada, id: r.registro_id }}>
                  <History className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>,
        ])}
      />

      <div ref={sentinel} className="flex items-center justify-center py-6 text-xs text-muted-foreground">
        {query.isFetchingNextPage ? (
          <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando mais…</span>
        ) : query.hasNextPage ? (
          <Button variant="outline" size="sm" onClick={() => query.fetchNextPage()}>Carregar mais</Button>
        ) : rows.length > 0 ? (
          `Fim da lista — ${rows.length} de ${total}`
        ) : null}
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              {detail && acaoBadge(detail.acao)}
              <span className="font-mono text-sm">{detail?.tabela_afetada}</span>
              <span className="text-xs text-muted-foreground font-normal">
                {detail && new Date(detail.created_at).toLocaleString("pt-BR")} • {detail?.usuario_sistema ?? "sistema"}
              </span>
              {detail?.registro_id && (
                <Button variant="link" size="sm" asChild className="ml-auto">
                  <Link to="/auditoria/$tabela/$id" params={{ tabela: detail.tabela_afetada, id: detail.registro_id }}>
                    <History className="h-4 w-4 mr-1" /> Ver timeline
                  </Link>
                </Button>
              )}
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
