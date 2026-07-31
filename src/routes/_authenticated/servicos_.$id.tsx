import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CrudDialog } from "@/components/crud-dialog";
import { StatusPill } from "@/components/status-pill";
import { Trash2, Plus, AlertTriangle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { criticidadeTone } from "@/lib/status-tones";

export const Route = createFileRoute("/_authenticated/servicos_/$id")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Ficha do Serviço — GestoraIT" },
      { name: "description", content: "Detalhes do serviço, ativos dependentes e risco operacional." },
    ],
  }),
});

const TIPOS_DEP = ["hospeda", "suporta", "depende_de"];

function statusBadge(s: string | null) {
  if (s === "em_uso") return <StatusPill tone="ok">em uso</StatusPill>;
  if (s === "manutencao" || s === "em_manutencao") return <StatusPill tone="warn">manutenção</StatusPill>;
  if (s === "baixado") return <StatusPill tone="critical">baixado</StatusPill>;
  if (s === "estoque" || s === "em_estoque") return <StatusPill tone="info">estoque</StatusPill>;
  return <StatusPill tone="neutral">{s ?? "—"}</StatusPill>;
}

function Page() {
  const { id } = Route.useParams();
  const { canWrite } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [ativoId, setAtivoId] = useState<string | null>(null);
  const [tipo, setTipo] = useState("suporta");

  const { data: servico } = useQuery({
    queryKey: ["servico", id],
    queryFn: async () => {
      const { data } = await supabase.from("servicos").select("*, usuarios:usuarios!responsavel_id(nome)").eq("id", id).maybeSingle();
      return data as any;
    },
  });
  const { data: vinculos } = useQuery({
    queryKey: ["servico-ativos", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ativos_servicos")
        .select("id,tipo_dependencia, ativos(id,hostname,setor,status_ciclo_vida)")
        .eq("servico_id", id);
      return (data ?? []) as any[];
    },
  });
  const { data: ativos } = useQuery({
    queryKey: ["ativos-lite-all"],
    queryFn: async () => (await supabase.from("ativos").select("id,hostname").order("hostname")).data ?? [],
  });

  const jaVinculados = new Set((vinculos ?? []).map((v: any) => v.ativos?.id));
  const emRisco = (vinculos ?? []).filter((v: any) => v.ativos && ((v.ativos.status_ciclo_vida === "manutencao" || v.ativos.status_ciclo_vida === "em_manutencao") || v.ativos.status_ciclo_vida === "baixado"));

  async function vincular() {
    if (!ativoId) return toast.error("Selecione o ativo");
    const { error } = await supabase.from("ativos_servicos").insert({ servico_id: id, ativo_id: ativoId, tipo_dependencia: tipo });
    if (error) return toast.error(error.message);
    void logAction("BULK_UPDATE", "ativos_servicos", { op: "vincular", servico_id: id, ativo_id: ativoId, tipo });
    toast.success("Ativo vinculado");
    setAtivoId(null); setTipo("suporta");
    qc.invalidateQueries({ queryKey: ["servico-ativos", id] });
    qc.invalidateQueries({ queryKey: ["servicos-ativos-count"] });
  }
  async function desvincular(vId: string) {
    const { error } = await supabase.from("ativos_servicos").delete().eq("id", vId);
    if (error) return toast.error(error.message);
    void logAction("BULK_UPDATE", "ativos_servicos", { op: "desvincular", id: vId });
    qc.invalidateQueries({ queryKey: ["servico-ativos", id] });
    qc.invalidateQueries({ queryKey: ["servicos-ativos-count"] });
  }

  return (
    <>
      <PageHeader
        title={servico?.nome ?? "Serviço"}
        description={
          <span className="flex items-center gap-2">
            <StatusPill tone={criticidadeTone(servico?.criticidade)}>{servico?.criticidade ?? "—"}</StatusPill>
            <span className="text-muted-foreground">Responsável: {servico?.usuarios?.nome ?? "—"}</span>
          </span>
        }
        actions={canWrite ? <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Vincular ativo</Button> : undefined}
      />

      {emRisco.length > 0 && (
        <Card className="mb-4 border-destructive/40">
          <CardContent className="flex items-center gap-3 pt-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div className="text-sm">
              <div className="font-medium">Risco operacional ao serviço</div>
              <div className="text-muted-foreground">
                {emRisco.length} ativo(s) fora de operação normal — o serviço pode estar degradado ou indisponível.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm">Ativos dependentes ({vinculos?.length ?? 0})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {(vinculos ?? []).length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground text-center">Nenhum ativo vinculado.</div>
            ) : (vinculos ?? []).map((v: any) => {
              const risco = v.ativos && ((v.ativos.status_ciclo_vida === "manutencao" || v.ativos.status_ciclo_vida === "em_manutencao") || v.ativos.status_ciclo_vida === "baixado");
              const cls = v.ativos?.status_ciclo_vida === "baixado" ? "bg-destructive/5" : (v.ativos?.status_ciclo_vida === "manutencao" || v.ativos?.status_ciclo_vida === "em_manutencao") ? "bg-[color:var(--warning)]/5" : "";
              return (
                <div key={v.id} className={`flex items-center justify-between gap-3 px-4 py-2 ${cls}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    {risco && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
                    <Link to="/ativos/$id" params={{ id: v.ativos?.id }} className="font-medium hover:underline truncate inline-flex items-center gap-1">
                      {v.ativos?.hostname ?? "—"} <ExternalLink className="h-3 w-3 opacity-50" />
                    </Link>
                    <span className="text-xs text-muted-foreground truncate">{v.ativos?.setor ?? "—"}</span>
                    <StatusPill tone="neutral" className="text-[10px]">{v.tipo_dependencia ?? "—"}</StatusPill>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(v.ativos?.status_ciclo_vida)}
                    {canWrite && (
                      <Button size="icon" variant="ghost" onClick={() => desvincular(v.id)}><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <CrudDialog title="Vincular ativo" open={open} onOpenChange={setOpen} onSubmit={vincular} trigger={null} submitLabel="Vincular">
        <div>
          <Label>Ativo *</Label>
          <Combobox
            placeholder="Selecionar ativo"
            searchPlaceholder="Buscar hostname…"
            value={ativoId}
            onChange={setAtivoId}
            options={(ativos ?? []).filter((a: any) => !jaVinculados.has(a.id)).map((a: any) => ({ value: a.id, label: a.hostname }))}
          />
        </div>
        <div>
          <Label>Tipo de dependência</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TIPOS_DEP.map((t) => <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </CrudDialog>
    </>
  );
}
