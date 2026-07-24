import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { DiffView } from "@/components/diff-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/auditoria_/$tabela/$id")({
  component: Page,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-6 space-y-3">
        <p className="text-destructive text-sm">Erro ao carregar timeline: {error.message}</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            reset();
            router.invalidate();
          }}
        >
          Tentar novamente
        </Button>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-6 text-sm text-muted-foreground">Registro não encontrado.</div>,
  head: ({ params }) => ({
    meta: [
      { title: `Timeline ${params.tabela} — Auditoria` },
      { name: "description", content: `Histórico completo de alterações no registro ${params.id} da tabela ${params.tabela}.` },
    ],
  }),
});

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

function dotColor(acao: string) {
  if (acao === "INSERT") return "bg-success";
  if (acao === "DELETE") return "bg-destructive";
  return "bg-primary";
}

function Page() {
  const { tabela, id } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["auditoria-timeline", tabela, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auditoria_log")
        .select("*")
        .eq("tabela_afetada", tabela)
        .eq("registro_id", id)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LogRow[];
    },
  });

  const events = data ?? [];
  const first = events[0];
  const last = events[events.length - 1];

  return (
    <>
      <div className="mb-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/auditoria"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar ao log</Link>
        </Button>
      </div>

      <PageHeader
        title="Timeline do registro"
        description={
          <span className="font-mono text-xs">
            {tabela} • {id}
          </span>
        }
      />

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando eventos…
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
          Nenhum evento registrado para este registro.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <KPI label="Eventos" value={events.length} />
            <KPI label="Primeiro" value={new Date(first.created_at).toLocaleString("pt-BR")} small />
            <KPI label="Último" value={new Date(last.created_at).toLocaleString("pt-BR")} small />
          </div>

          <ol className="relative border-l border-border ml-3 space-y-4">
            {events.map((ev, idx) => (
              <li key={ev.id} className="ml-6">
                <span
                  className={`absolute -left-[7px] mt-1.5 h-3.5 w-3.5 rounded-full ring-4 ring-background ${dotColor(ev.acao)}`}
                />
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="text-xs text-muted-foreground font-mono">#{idx + 1}</span>
                    {acaoBadge(ev.acao)}
                    <span className="text-xs text-muted-foreground">
                      {new Date(ev.created_at).toLocaleString("pt-BR")}
                    </span>
                    <span className="text-xs ml-auto">{ev.usuario_sistema ?? "sistema"}</span>
                  </div>
                  {ev.acao === "UPDATE" && (
                    <div className="grid grid-cols-[160px_1fr_1fr] gap-2 pb-2 text-xs text-muted-foreground border-b border-border/60 mb-2">
                      <span>Campo</span>
                      <span>Antes</span>
                      <span>Depois</span>
                    </div>
                  )}
                  <DiffView
                    before={ev.valor_anterior}
                    after={ev.valor_novo}
                    onlyChanged={ev.acao === "UPDATE"}
                  />
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  );
}

function KPI({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={small ? "text-sm font-medium" : "text-2xl font-semibold"}>{value}</div>
    </div>
  );
}
