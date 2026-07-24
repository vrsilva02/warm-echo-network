import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/auditoria")({
  component: Page,
  head: () => ({ meta: [{ title: "Auditoria — ITAM/SAM" }, { name: "description", content: "Log imutável de ações no sistema." }] }),
});

function Page() {
  const { data, isLoading } = useQuery({
    queryKey: ["auditoria"],
    queryFn: async () => (await supabase.from("auditoria_log").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  return (
    <>
      <PageHeader title="Log de Auditoria" description="Últimas 200 ações registradas automaticamente." />
      <DataTable
        columns={["Quando", "Ação", "Tabela", "Registro"]}
        empty={isLoading ? "Carregando…" : "Sem eventos ainda."}
        rows={(data ?? []).map((r: any) => [
          <span key="w" className="font-mono text-xs">{new Date(r.created_at).toLocaleString("pt-BR")}</span>,
          <Badge key="a" variant="outline">{r.acao}</Badge>,
          r.tabela_afetada,
          <span key="i" className="font-mono text-xs">{r.registro_id?.slice(0, 8) ?? "—"}</span>,
        ])}
      />
    </>
  );
}
