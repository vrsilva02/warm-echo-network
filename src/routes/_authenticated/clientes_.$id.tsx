import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clientes_/$id")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Ficha do cliente — GestoraIT" },
      { name: "description", content: "Ativos, contratos e licenças associados ao cliente." },
    ],
  }),
});

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function Page() {
  const { id } = Route.useParams();

  const { data: cliente } = useQuery({
    queryKey: ["cliente", id],
    queryFn: async () => (await supabase.from("clientes").select("*").eq("id", id).maybeSingle()).data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["cliente-360", id],
    queryFn: async () => {
      const [ativos, contratos, licencas] = await Promise.all([
        supabase
          .from("ativos")
          .select("id, hostname, tipo, categoria, marca, modelo, numero_patrimonio, status_ciclo_vida")
          .eq("cliente_id", id)
          .order("hostname"),
        supabase
          .from("contratos")
          .select("id, fornecedor, numero_contrato, tipo_contrato, data_fim, quantidade_seats, valor_total")
          .eq("cliente_id", id)
          .order("data_fim", { ascending: true, nullsFirst: false }),
        supabase
          .from("licencas")
          .select("id, quantidade, data_expiracao, custo_unitario, produtos_catalogo(nome_oficial, categoria)")
          .eq("cliente_id", id),
      ]);
      return {
        ativos: (ativos.data ?? []) as any[],
        contratos: (contratos.data ?? []) as any[],
        licencas: (licencas.data ?? []) as any[],
      };
    },
  });

  const seats = (data?.licencas ?? []).reduce((s, l: any) => s + (l.quantidade ?? 0), 0);
  const custoLicencas = (data?.licencas ?? []).reduce(
    (s, l: any) => s + (l.quantidade ?? 0) * Number(l.custo_unitario ?? 0),
    0,
  );

  return (
    <>
      <PageHeader
        title={cliente?.nome ?? "Cliente"}
        description={
          [cliente?.codigo, cliente?.documento, cliente?.contato].filter(Boolean).join(" · ") ||
          "Ativos, contratos e licenças associados a este cliente."
        }
        actions={
          <Button asChild size="sm" variant="outline">
            <Link to="/clientes"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Metric label="Ativos" value={data?.ativos.length ?? 0} />
        <Metric label="Contratos" value={data?.contratos.length ?? 0} />
        <Metric label="Seats de licença" value={seats} />
        <Metric
          label="Custo de licenças"
          value={`R$ ${custoLicencas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
        />
      </div>

      <section className="space-y-2 mb-8">
        <h2 className="text-sm font-semibold">Ativos</h2>
        <DataTable
          columns={["Hostname", "Tipo", "Categoria", "Marca/Modelo", "Patrimônio", "Status"]}
          empty={isLoading ? "Carregando…" : "Nenhum ativo associado a este cliente."}
          rows={(data?.ativos ?? []).map((a: any) => [
            <Link key="h" to="/ativos/$id" params={{ id: a.id }} className="font-medium hover:underline">{a.hostname}</Link>,
            a.tipo,
            a.categoria ?? "—",
            [a.marca, a.modelo].filter(Boolean).join(" ") || "—",
            <span key="p" className="font-mono text-xs">{a.numero_patrimonio ?? "—"}</span>,
            <Badge key="s" variant="outline">{String(a.status_ciclo_vida).replace("_", " ")}</Badge>,
          ])}
        />
      </section>

      <section className="space-y-2 mb-8">
        <h2 className="text-sm font-semibold">Contratos</h2>
        <DataTable
          columns={["Fornecedor", "Nº", "Tipo", "Fim", "Seats", "Valor"]}
          empty={isLoading ? "Carregando…" : "Nenhum contrato associado a este cliente."}
          rows={(data?.contratos ?? []).map((c: any) => [
            <span key="f" className="font-medium">{c.fornecedor}</span>,
            c.numero_contrato ?? "—",
            c.tipo_contrato ?? "—",
            c.data_fim ?? "—",
            c.quantidade_seats,
            c.valor_total ? `R$ ${Number(c.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—",
          ])}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Licenças</h2>
        <DataTable
          columns={["Produto", "Categoria", "Quantidade", "Expiração", "Custo unitário"]}
          empty={isLoading ? "Carregando…" : "Nenhuma licença associada a este cliente."}
          rows={(data?.licencas ?? []).map((l: any) => [
            <span key="p" className="font-medium">{l.produtos_catalogo?.nome_oficial ?? "—"}</span>,
            l.produtos_catalogo?.categoria ?? "—",
            l.quantidade,
            l.data_expiracao ?? "—",
            l.custo_unitario ? `R$ ${Number(l.custo_unitario).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—",
          ])}
        />
      </section>
    </>
  );
}
