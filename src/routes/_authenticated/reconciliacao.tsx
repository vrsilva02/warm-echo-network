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
import { DataTable, ListToolbar, useFilteredList } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Upload, CheckCircle2, AlertCircle, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { downloadXLSX } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/reconciliacao")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Reconciliação — GestoraIT" },
      { name: "description", content: "Importe inventário CSV e reconcilie automaticamente via aliases do catálogo." },
    ],
  }),
});

type Item = {
  id: string;
  origem: string;
  hostname: string | null;
  produto_nome_bruto: string;
  produto_id: string | null;
  data_importacao: string;
  data_ultima_comunicacao: string | null;
  reconciliado: boolean;
  produtos_catalogo?: { nome_oficial: string } | null;
};

type Produto = { id: string; nome_oficial: string };
type Alias = { alias: string; produto_id: string };

function norm(s: string) {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function Page() {
  const { canWrite } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [origem, setOrigem] = useState("SCCM");
  const [busy, setBusy] = useState(false);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["inventario"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventario_importado")
        .select("*, produtos_catalogo(nome_oficial)")
        .order("data_importacao", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as unknown as Item[];
    },
  });
  const { data: produtos } = useQuery({
    queryKey: ["produtos-min"],
    queryFn: async () => (await supabase.from("produtos_catalogo").select("id,nome_oficial")).data as Produto[] ?? [],
  });
  const { data: aliases } = useQuery({
    queryKey: ["produtos-aliases"],
    queryFn: async () => (await supabase.from("produtos_aliases").select("alias,produto_id")).data as Alias[] ?? [],
  });

  const filtered = useFilteredList(rows, q, ["produto_nome_bruto", "hostname", "origem"]).filter((r) => {
    if (filtroStatus === "reconciliado") return r.reconciliado;
    if (filtroStatus === "pendente") return !r.reconciliado;
    return true;
  });

  const stats = useMemo(() => {
    const total = rows?.length ?? 0;
    const rec = rows?.filter((r) => r.reconciliado).length ?? 0;
    return { total, rec, pend: total - rec };
  }, [rows]);

  function matchProduto(bruto: string): string | null {
    const n = norm(bruto);
    if (!n) return null;
    // 1. alias exato
    const aliasHit = (aliases ?? []).find((a) => norm(a.alias) === n);
    if (aliasHit) return aliasHit.produto_id;
    // 2. nome oficial exato
    const exact = (produtos ?? []).find((p) => norm(p.nome_oficial) === n);
    if (exact) return exact.id;
    // 3. alias contido / contém
    const partialAlias = (aliases ?? []).find((a) => {
      const an = norm(a.alias);
      return an && (n.includes(an) || an.includes(n));
    });
    if (partialAlias) return partialAlias.produto_id;
    // 4. nome oficial parcial
    const partial = (produtos ?? []).find((p) => {
      const pn = norm(p.nome_oficial);
      return pn && (n.includes(pn) || pn.includes(n));
    });
    return partial?.id ?? null;
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) {
      toast.error("Formato inválido. Envie um arquivo .xlsx.");
      e.target.value = "";
      return;
    }
    setBusy(true);
    try {
      const { parseTabularFile } = await import("@/lib/import-parser");
      const parsed = await parseTabularFile(file);
      const linhas = parsed.rows.filter((r) => Object.keys(r).length > 0);
      if (linhas.length === 0) {
        toast.error("Planilha vazia.");
        return;
      }
      const getCol = (row: any, ...names: string[]) => {
        for (const n of names) {
          const key = Object.keys(row).find((k) => k.toLowerCase().trim() === n.toLowerCase());
          if (key && row[key]) return String(row[key]).trim();
        }
        return "";
      };

      const registros = linhas
        .map((row) => {
          const produto_nome_bruto = getCol(row, "produto", "software", "product", "nome");
          if (!produto_nome_bruto) return null;
          const hostname = getCol(row, "hostname", "host", "computador", "device") || null;
          const ultima = getCol(row, "ultima_comunicacao", "last_seen", "last_communication");
          return {
            origem,
            hostname,
            produto_nome_bruto,
            produto_id: matchProduto(produto_nome_bruto),
            data_ultima_comunicacao: ultima ? new Date(ultima).toISOString() : null,
            reconciliado: !!matchProduto(produto_nome_bruto),
          };
        })
        .filter(Boolean) as any[];

      if (registros.length === 0) {
        toast.error("Nenhuma linha válida encontrada. Verifique se há coluna produto/software.");
        return;
      }

      for (let i = 0; i < registros.length; i += 500) {
        const chunk = registros.slice(i, i + 500);
        const { error } = await supabase.from("inventario_importado").insert(chunk);
        if (error) throw error;
      }
      const rec = registros.filter((r) => r.reconciliado).length;
      toast.success(`${registros.length} linhas importadas · ${rec} reconciliadas automaticamente`);
      qc.invalidateQueries({ queryKey: ["inventario"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Falha na importação");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }


  async function reconciliarPendentes() {
    const pendentes = (rows ?? []).filter((r) => !r.reconciliado);
    if (pendentes.length === 0) return toast.info("Nada a reconciliar.");
    setBusy(true);
    let ok = 0;
    for (const item of pendentes) {
      const pid = matchProduto(item.produto_nome_bruto);
      if (pid) {
        await supabase.from("inventario_importado").update({ produto_id: pid, reconciliado: true }).eq("id", item.id);
        ok++;
      }
    }
    setBusy(false);
    toast.success(`${ok} de ${pendentes.length} reconciliadas`);
    qc.invalidateQueries({ queryKey: ["inventario"] });
  }

  async function vincular(item: Item, produtoId: string) {
    if (item.produto_id !== produtoId) {
      const jaExiste = (aliases ?? []).some(
        (a) => a.produto_id === produtoId && norm(a.alias) === norm(item.produto_nome_bruto),
      );
      if (!jaExiste) {
        const { error: aliasErr } = await supabase.from("produtos_aliases").insert({
          produto_id: produtoId,
          alias: item.produto_nome_bruto,
        });
        if (aliasErr) console.warn(aliasErr);
      }
    }
    const { error } = await supabase
      .from("inventario_importado")
      .update({ produto_id: produtoId, reconciliado: true })
      .eq("id", item.id);
    if (error) return toast.error(error.message);
    toast.success("Vinculado — alias salvo para próximas importações");
    qc.invalidateQueries({ queryKey: ["inventario"] });
    qc.invalidateQueries({ queryKey: ["produtos-aliases"] });
  }

  function exportar() {
    downloadXLSX(
      `inventario-${new Date().toISOString().slice(0, 10)}.xlsx`,
      ["Origem", "Hostname", "Produto bruto", "Produto catálogo", "Última comunicação", "Reconciliado"],
      (rows ?? []).map((r) => [
        r.origem,
        r.hostname ?? "",
        r.produto_nome_bruto,
        r.produtos_catalogo?.nome_oficial ?? "",
        r.data_ultima_comunicacao ?? "",
        r.reconciliado ? "sim" : "não",
      ]),
    );
  }

  return (
    <>
      <PageHeader
        title="Reconciliação de Inventário"
        description="Importe CSV do SCCM/Intune/CrowdStrike e vincule automaticamente aos produtos do catálogo."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Registros" value={stats.total} />
        <StatCard label="Reconciliados" value={stats.rec} tone="success" />
        <StatCard label="Pendentes" value={stats.pend} tone="warning" />
      </div>

      {canWrite && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm">Importar CSV</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Colunas aceitas (qualquer ordem): <code>produto</code> ou <code>software</code>, opcional{" "}
              <code>hostname</code> e <code>ultima_comunicacao</code>.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <Label>Origem</Label>
                <Select value={origem} onValueChange={setOrigem}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["SCCM", "Intune", "CrowdStrike", "Lansweeper", "Manual", "Outro"].map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Arquivo CSV</Label>
                <Input type="file" accept=".csv,text/csv" onChange={onFile} disabled={busy} />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={reconciliarPendentes} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                Reconciliar pendentes
              </Button>
              <Button size="sm" variant="outline" onClick={exportar}>
                <Upload className="h-4 w-4 rotate-180" /> Exportar XLSX
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <ListToolbar
        query={q}
        onQueryChange={setQ}
        actions={
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="reconciliado">Reconciliados</SelectItem>
              <SelectItem value="pendente">Pendentes</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <DataTable
        columns={["Origem", "Hostname", "Produto bruto", "Catálogo", "Status", "Ação"]}
        empty={isLoading ? "Carregando…" : "Nenhum registro. Importe um CSV para começar."}
        rows={filtered.map((r) => [
          <Badge key="o" variant="outline">{r.origem}</Badge>,
          r.hostname ?? "—",
          <span key="p" className="font-medium">{r.produto_nome_bruto}</span>,
          r.produtos_catalogo?.nome_oficial ?? <span className="text-muted-foreground">—</span>,
          r.reconciliado ? (
            <Badge key="s" variant="outline" className="bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Reconciliado
            </Badge>
          ) : (
            <Badge key="s" variant="outline" className="bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30">
              <AlertCircle className="h-3 w-3 mr-1" /> Pendente
            </Badge>
          ),
          canWrite ? (
            <Select key="a" value={r.produto_id ?? ""} onValueChange={(v) => vincular(r, v)}>
              <SelectTrigger className="w-56 h-8"><SelectValue placeholder="Vincular a…" /></SelectTrigger>
              <SelectContent>
                {(produtos ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.nome_oficial}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : <span key="a">—</span>,
        ])}
      />
    </>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "success" | "warning" }) {
  const cls = tone === "success" ? "text-[color:var(--success)]" : tone === "warning" ? "text-[color:var(--warning)]" : "";
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold ${cls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
