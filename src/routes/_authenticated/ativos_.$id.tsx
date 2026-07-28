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
import { TcoCard } from "@/components/tco-card";
import { EdrBadge, useGapEdrSet } from "@/components/edr-badge";
import { Trash2, Plus, Server, ServerCog, Boxes, ExternalLink, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { logAction } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/ativos_/$id")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Ficha do Ativo — GestoraIT" },
      { name: "description", content: "Visão 360° do ativo: serviços dependentes, topologia e TCO." },
    ],
  }),
});

const TIPOS_DEP = ["hospeda", "suporta", "depende_de"];
const TIPOS_REL = ["hospeda_vm", "conecta", "depende_de", "backup_de"];

function ativoStatus(s: string | null) {
  if (s === "em_uso") return <StatusPill tone="ok">em uso</StatusPill>;
  if (s === "em_manutencao") return <StatusPill tone="warn">manutenção</StatusPill>;
  if (s === "baixado") return <StatusPill tone="critical">baixado</StatusPill>;
  if (s === "em_estoque") return <StatusPill tone="info">estoque</StatusPill>;
  return <StatusPill tone="neutral">{s ?? "—"}</StatusPill>;
}

function Page() {
  const { id } = Route.useParams();
  const { canWrite } = useAuth();
  const qc = useQueryClient();
  const { set: edrSet } = useGapEdrSet();
  const [openServ, setOpenServ] = useState(false);
  const [openRel, setOpenRel] = useState(false);
  const [servId, setServId] = useState<string | null>(null);
  const [tipoDep, setTipoDep] = useState("suporta");
  const [filhoId, setFilhoId] = useState<string | null>(null);
  const [tipoRel, setTipoRel] = useState("hospeda_vm");

  const { data: ativo } = useQuery({
    queryKey: ["ativo", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ativos")
        .select("*, usuarios(nome), centros_custo(nome), unidades(nome)")
        .eq("id", id).maybeSingle();
      return data as any;
    },
  });
  const { data: servicos } = useQuery({
    queryKey: ["ativo-servicos", id],
    queryFn: async () => (await supabase.from("ativos_servicos").select("id,tipo_dependencia, servicos(id,nome,criticidade)").eq("ativo_id", id)).data ?? [],
  });
  const { data: filhos } = useQuery({
    queryKey: ["ativo-filhos", id],
    queryFn: async () => (await supabase.from("ativos_relacionamentos").select("id,tipo_relacao, filho:ativos!ativo_filho_id(id,hostname,tipo,status_ciclo_vida)").eq("ativo_pai_id", id)).data ?? [],
  });
  const { data: pais } = useQuery({
    queryKey: ["ativo-pais", id],
    queryFn: async () => (await supabase.from("ativos_relacionamentos").select("id,tipo_relacao, pai:ativos!ativo_pai_id(id,hostname,tipo)").eq("ativo_filho_id", id)).data ?? [],
  });
  const { data: servicosList } = useQuery({
    queryKey: ["servicos-lite"],
    queryFn: async () => (await supabase.from("servicos").select("id,nome").order("nome")).data ?? [],
  });
  const { data: ativosList } = useQuery({
    queryKey: ["ativos-lite-all"],
    queryFn: async () => (await supabase.from("ativos").select("id,hostname").order("hostname")).data ?? [],
  });

  const jaServ = new Set((servicos ?? []).map((v: any) => v.servicos?.id));
  const jaFilhos = new Set((filhos ?? []).map((v: any) => v.filho?.id));

  async function vincServ() {
    if (!servId) return toast.error("Selecione o serviço");
    const { error } = await supabase.from("ativos_servicos").insert({ ativo_id: id, servico_id: servId, tipo_dependencia: tipoDep });
    if (error) return toast.error(error.message);
    void logAction("BULK_UPDATE", "ativos_servicos", { op: "vincular", ativo_id: id, servico_id: servId });
    setServId(null); setTipoDep("suporta");
    qc.invalidateQueries({ queryKey: ["ativo-servicos", id] });
    qc.invalidateQueries({ queryKey: ["servicos-ativos-count"] });
    toast.success("Vinculado");
  }
  async function desvincServ(vId: string) {
    const { error } = await supabase.from("ativos_servicos").delete().eq("id", vId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["ativo-servicos", id] });
    qc.invalidateQueries({ queryKey: ["servicos-ativos-count"] });
  }
  async function addRel() {
    if (!filhoId) return toast.error("Selecione o ativo filho");
    if (filhoId === id) return toast.error("Não é possível relacionar consigo mesmo");
    const { error } = await supabase.from("ativos_relacionamentos").insert({ ativo_pai_id: id, ativo_filho_id: filhoId, tipo_relacao: tipoRel });
    if (error) return toast.error(error.message);
    void logAction("BULK_UPDATE", "ativos_relacionamentos", { op: "adicionar", pai: id, filho: filhoId, tipo: tipoRel });
    setFilhoId(null); setTipoRel("hospeda_vm");
    qc.invalidateQueries({ queryKey: ["ativo-filhos", id] });
    toast.success("Adicionado");
  }
  async function remRel(rId: string) {
    const { error } = await supabase.from("ativos_relacionamentos").delete().eq("id", rId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["ativo-filhos", id] });
  }

  return (
    <>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            {ativo?.hostname ?? "Ativo"}
            <EdrBadge ativoId={id} set={edrSet} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            {ativoStatus(ativo?.status_ciclo_vida)}
            <span className="text-muted-foreground">
              {ativo?.tipo} · Patrimônio: <span className="font-mono">{ativo?.numero_patrimonio ?? "—"}</span> · Setor: {ativo?.setor ?? "—"}
              {ativo?.centros_custo?.nome && <> · Centro: {ativo.centros_custo.nome}</>}
              {ativo?.usuarios?.nome && <> · Responsável: {ativo.usuarios.nome}</>}
            </span>
          </span>
        }
        actions={
          <Button asChild size="sm" variant="outline">
            <Link to="/ativos"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-1">
          <TcoCard ativoId={id} />
        </div>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Boxes className="h-4 w-4" /> Serviços dependentes</CardTitle>
            {canWrite && <Button size="sm" variant="outline" onClick={() => setOpenServ(true)}><Plus className="h-3 w-3 mr-1" />Vincular</Button>}
          </CardHeader>
          <CardContent>
            {(servicos ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">Nenhum serviço vinculado.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(servicos ?? []).map((v: any) => (
                  <div key={v.id} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
                    <Link to="/servicos/$id" params={{ id: v.servicos?.id }} className="font-medium hover:underline">{v.servicos?.nome}</Link>
                    <span className="text-muted-foreground">· {v.tipo_dependencia ?? "—"}</span>
                    {canWrite && (
                      <button className="text-muted-foreground hover:text-destructive" onClick={() => desvincServ(v.id)} title="Remover">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><ServerCog className="h-4 w-4" /> Topologia</CardTitle>
          {canWrite && <Button size="sm" variant="outline" onClick={() => setOpenRel(true)}><Plus className="h-3 w-3 mr-1" />Adicionar filho</Button>}
        </CardHeader>
        <CardContent>
          {(pais ?? []).length > 0 && (
            <div className="mb-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Este ativo depende de</div>
              <ul className="space-y-1">
                {(pais ?? []).map((p: any) => (
                  <li key={p.id} className="text-sm flex items-center gap-2">
                    <Server className="h-4 w-4 text-muted-foreground" />
                    <Link to="/ativos/$id" params={{ id: p.pai?.id }} className="hover:underline">{p.pai?.hostname}</Link>
                    <span className="text-xs text-muted-foreground">· {p.tipo_relacao ?? "—"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Filhos deste ativo</div>
          {(filhos ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Sem ativos filhos.</div>
          ) : (
            <ul className="space-y-1 ml-2 border-l pl-4">
              {(filhos ?? []).map((f: any) => (
                <li key={f.id} className="text-sm flex items-center gap-2">
                  <ServerCog className="h-4 w-4 text-primary" />
                  <Link to="/ativos/$id" params={{ id: f.filho?.id }} className="font-medium hover:underline inline-flex items-center gap-1">
                    {f.filho?.hostname} <ExternalLink className="h-3 w-3 opacity-50" />
                  </Link>
                  <span className="text-xs text-muted-foreground">· {f.filho?.tipo} · {f.tipo_relacao ?? "—"}</span>
                  {ativoStatus(f.filho?.status_ciclo_vida)}
                  {canWrite && (
                    <Button size="icon" variant="ghost" className="h-6 w-6 ml-auto" onClick={() => remRel(f.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <CrudDialog title="Vincular serviço" open={openServ} onOpenChange={setOpenServ} onSubmit={vincServ} trigger={null} submitLabel="Vincular">
        <div>
          <Label>Serviço *</Label>
          <Combobox
            placeholder="Selecionar serviço"
            searchPlaceholder="Buscar…"
            value={servId}
            onChange={setServId}
            options={(servicosList ?? []).filter((s: any) => !jaServ.has(s.id)).map((s: any) => ({ value: s.id, label: s.nome }))}
          />
        </div>
        <div>
          <Label>Tipo de dependência</Label>
          <Select value={tipoDep} onValueChange={setTipoDep}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TIPOS_DEP.map((t) => <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </CrudDialog>

      <CrudDialog title="Adicionar ativo filho" open={openRel} onOpenChange={setOpenRel} onSubmit={addRel} trigger={null} submitLabel="Adicionar">
        <div>
          <Label>Ativo filho *</Label>
          <Combobox
            placeholder="Selecionar ativo"
            searchPlaceholder="Buscar hostname…"
            value={filhoId}
            onChange={setFilhoId}
            options={(ativosList ?? []).filter((a: any) => a.id !== id && !jaFilhos.has(a.id)).map((a: any) => ({ value: a.id, label: a.hostname }))}
          />
        </div>
        <div>
          <Label>Tipo de relação</Label>
          <Select value={tipoRel} onValueChange={setTipoRel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TIPOS_REL.map((t) => <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </CrudDialog>
    </>
  );
}
